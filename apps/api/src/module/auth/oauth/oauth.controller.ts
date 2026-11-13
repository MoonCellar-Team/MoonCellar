import {
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { CookieOptions, Request, Response } from "express";
import type { IOAuthAccounts } from "@mooncellar/schemas";
import { FRONT_URL } from "../../../shared/constants";
import { SIGN_IN_THROTTLE } from "../../../shared/throttle";
import type {
  IOptionalViewerRequest,
  IViewerRequest,
} from "../../collections/types/collections.type";
import { AuthService } from "../auth.service";
import { getAuthCookieOptions } from "../auth-cookies";
import { OptionalJwtGuard } from "../optional-jwt.guard";
import { OAuthService } from "./oauth.service";
import {
  OAUTH_PROVIDERS,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_MS,
  OAuthFlowError,
  type TOAuthProvider,
} from "./oauth.types";

const STATE_COOKIE_PATH = "/auth/oauth";

interface IOAuthCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
}

const viewerOrigin = (request: Request): string =>
  request.headers.origin ?? FRONT_URL;

const callbackUrl = (request: Request, provider: TOAuthProvider): string =>
  `${request.protocol}://${request.get("host")}/auth/oauth/${provider}/callback`;

@ApiTags("Auth")
@Controller("auth/oauth")
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly oauth: OAuthService,
    private readonly authService: AuthService
  ) {}

  private readProvider(provider: string): TOAuthProvider {
    if (!OAUTH_PROVIDERS.includes(provider as TOAuthProvider)) {
      throw new NotFoundException("Unknown sign-in provider");
    }

    return provider as TOAuthProvider;
  }

  private stateCookieOptions(origin: string): CookieOptions {
    return {
      ...getAuthCookieOptions(origin),
      path: STATE_COOKIE_PATH,
      maxAge: OAUTH_STATE_TTL_MS,
    };
  }

  private errorRedirect(res: Response, code: string, provider?: string): void {
    const params = new URLSearchParams({ status: "error", error: code });

    if (provider) params.set("provider", provider);

    res.redirect(302, `${FRONT_URL}/auth/oauth?${params.toString()}`);
  }

  @Get()
  @UseGuards(AuthGuard("jwt"))
  @ApiCookieAuth()
  @ApiOperation({ summary: "Providers of the signed-in account" })
  accounts(@Req() request: IViewerRequest): IOAuthAccounts {
    return this.oauth.accounts(request.user);
  }

  @Get(":provider")
  @UseGuards(OptionalJwtGuard)
  @Throttle(SIGN_IN_THROTTLE)
  @ApiOperation({ summary: "Start signing in or linking a provider account" })
  start(
    @Param("provider") provider: string,
    @Query("link") link: string | undefined,
    @Req() request: IOptionalViewerRequest,
    @Res() res: Response
  ): Response {
    const origin = viewerOrigin(request);

    try {
      const providerId = this.readProvider(provider);
      const viewer = request.user ?? null;
      const isLink = link === "1" && !!viewer;
      const { state, nonce } = this.oauth.createState(
        providerId,
        isLink ? "link" : "sign-in",
        isLink && viewer ? String(viewer._id) : undefined
      );

      const authorizeUrl = this.oauth.authorizeUrl(
        providerId,
        state,
        callbackUrl(request, providerId)
      );

      res.cookie(OAUTH_STATE_COOKIE, nonce, this.stateCookieOptions(origin));
      res.redirect(302, authorizeUrl);

      return res;
    } catch (error) {
      if (error instanceof OAuthFlowError) {
        this.errorRedirect(res, error.code, provider);
        return res;
      }

      this.logger.error(error, `Could not start the ${provider} sign-in`);
      this.errorRedirect(res, "provider-failed", provider);
      return res;
    }
  }

  @Get(":provider/callback")
  @ApiOperation({ summary: "Finish signing in or linking a provider account" })
  async callback(
    @Param("provider") provider: string,
    @Query() query: IOAuthCallbackQuery,
    @Req() request: IOptionalViewerRequest,
    @Res() res: Response
  ): Promise<Response> {
    const origin = viewerOrigin(request);
    const clearState = () =>
      res.clearCookie(OAUTH_STATE_COOKIE, this.stateCookieOptions(origin));

    try {
      const providerId = this.readProvider(provider);

      if (query.error) throw new OAuthFlowError("cancelled");

      const state = this.oauth.readState(query.state ?? "");
      if (state.provider !== providerId) {
        throw new OAuthFlowError("provider-failed");
      }

      const nonce = request.cookies?.[OAUTH_STATE_COOKIE];
      if (!nonce || nonce !== state.nonce) {
        throw new OAuthFlowError("state-expired");
      }

      if (!query.code) throw new OAuthFlowError("provider-failed");

      const profile = await this.oauth.exchange(
        providerId,
        query.code,
        callbackUrl(request, providerId)
      );
      clearState();

      if (state.mode === "link") {
        if (!state.userId) throw new OAuthFlowError("provider-failed");

        await this.oauth.link(profile, state.userId);

        res.redirect(
          302,
          `${FRONT_URL}/auth/oauth?status=linked&provider=${providerId}`
        );

        return res;
      }

      const { user } = await this.oauth.signIn(profile);
      const method = await this.authService.startTwoFactorChallenge(user);

      if (method !== "off") {
        const ticket = this.authService.createTwoFactorTicket(user);
        const params = new URLSearchParams({
          status: "two-factor",
          method,
          ticket,
        });

        res.redirect(302, `${FRONT_URL}/auth/oauth?${params.toString()}`);

        return res;
      }

      const tokens = await this.authService.generateTokensAndUpdateUser(user);
      this.authService.setCookies(
        res,
        tokens.accessToken,
        tokens.refreshToken,
        origin
      );

      res.redirect(
        302,
        `${FRONT_URL}/auth/oauth?status=signed-in&userId=${user._id}`
      );

      return res;
    } catch (error) {
      clearState();

      if (error instanceof OAuthFlowError) {
        this.errorRedirect(res, error.code, provider);
        return res;
      }

      this.logger.error(error, `The ${provider} sign-in failed`);
      this.errorRedirect(res, "provider-failed", provider);
      return res;
    }
  }

  @Delete(":provider")
  @UseGuards(AuthGuard("jwt"))
  @ApiCookieAuth()
  @ApiOperation({ summary: "Unlink a provider account" })
  async unlink(
    @Param("provider") provider: string,
    @Req() request: IViewerRequest
  ): Promise<IOAuthAccounts> {
    const providerId = this.readProvider(provider);

    await this.oauth.unlink(request.user, providerId);

    return this.oauth.accountsFor(String(request.user._id));
  }
}
