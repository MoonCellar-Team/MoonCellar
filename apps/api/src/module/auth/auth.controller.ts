import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthGuard } from "@nestjs/passport";
import type { Request, Response } from "express";
import { UserProfileService } from "../user/services/user-profile.service";
import { AuthService } from "./auth.service";
import { TwoFactorService } from "./two-factor.service";
import { LoginDto } from "./dto/login.dto";
import { SignUpDto } from "./dto/signup.dto";
import { JwtRefreshGuard } from "./jwt-refresh.guard";
import { SIGN_IN_THROTTLE, SIGN_UP_THROTTLE } from "../../shared/throttle";
import {
  AddEmailDto,
  ConfirmEmailDto,
  ResendEmailCodeDto,
  TwoFactorConfirmDto,
  TwoFactorDisableDto,
  TwoFactorSetupDto,
  TwoFactorTicketDto,
  TwoFactorVerifyDto,
  VerifyEmailDto,
} from "../../shared/zod/dto/auth.dto";
import type { IAuthorizedRequest } from "../comments/types/community.type";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
    private readonly jwtService: JwtService
  ) {}

  @Post("/signup")
  @Throttle(SIGN_UP_THROTTLE)
  @ApiOperation({ summary: "User registration" })
  @ApiResponse({
    status: 201,
    description: "Registration successful",
  })
  async signUp(
    @Body() signUpDto: SignUpDto,
    @Res() res: Response
  ): Promise<Response> {
    const { userId, email } = await this.authService.signUp(signUpDto);
    return res.status(HttpStatus.OK).json({ userId, email });
  }

  @Post("/verify-email")
  @Throttle(SIGN_IN_THROTTLE)
  @ApiOperation({ summary: "Confirm the e-mail code sent at sign-up" })
  @ApiResponse({ status: 200, description: "Email confirmed" })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res() res: Response,
    @Headers() headers: any
  ): Promise<Response> {
    const { accessToken, refreshToken, userId } =
      await this.authService.verifyEmail(dto);
    this.authService.setCookies(
      res,
      accessToken,
      refreshToken,
      headers?.origin
    );
    return res.status(HttpStatus.OK).json({ userId });
  }

  @Post("/verify-email/resend")
  @Throttle(SIGN_IN_THROTTLE)
  @ApiOperation({ summary: "Send the sign-up code again" })
  @ApiResponse({ status: 200, description: "Code sent" })
  async resendVerificationCode(
    @Body() dto: ResendEmailCodeDto,
    @Res() res: Response
  ): Promise<Response> {
    return res
      .status(HttpStatus.OK)
      .json(await this.authService.resendVerificationCode(dto));
  }

  @Post("/login")
  @Throttle(SIGN_IN_THROTTLE)
  @ApiOperation({ summary: "User auth" })
  @ApiResponse({
    status: 200,
    description: "Auth successful",
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res() res: Response,
    @Headers() headers: any
  ): Promise<Response> {
    const result = await this.authService.login(loginDto);

    if ("twoFactorRequired" in result) {
      return res.status(HttpStatus.OK).json(result);
    }

    this.authService.setCookies(
      res,
      result.accessToken,
      result.refreshToken,
      headers?.origin
    );
    return res.status(HttpStatus.OK).json({ userId: result.userId });
  }

  @Post("/two-factor")
  @Throttle(SIGN_IN_THROTTLE)
  @ApiOperation({ summary: "Finish signing in with a two-factor code" })
  @ApiResponse({ status: 200, description: "Auth successful" })
  async verifyTwoFactor(
    @Body() dto: TwoFactorVerifyDto,
    @Res() res: Response,
    @Headers() headers: any
  ): Promise<Response> {
    const { accessToken, refreshToken, userId } =
      await this.authService.verifyTwoFactor(dto);
    this.authService.setCookies(
      res,
      accessToken,
      refreshToken,
      headers?.origin
    );
    return res.status(HttpStatus.OK).json({ userId });
  }

  @Post("/two-factor/ticket")
  @Throttle(SIGN_IN_THROTTLE)
  @ApiOperation({
    summary: "Finish an OAuth sign-in with a two-factor code",
  })
  @ApiResponse({ status: 200, description: "Auth successful" })
  async verifyTwoFactorTicket(
    @Body() dto: TwoFactorTicketDto,
    @Res() res: Response,
    @Headers() headers: any
  ): Promise<Response> {
    const { accessToken, refreshToken, userId } =
      await this.authService.verifyTwoFactorTicket(dto);
    this.authService.setCookies(
      res,
      accessToken,
      refreshToken,
      headers?.origin
    );
    return res.status(HttpStatus.OK).json({ userId });
  }

  @Post("/email")
  @UseGuards(AuthGuard("jwt"))
  @Throttle(SIGN_UP_THROTTLE)
  @ApiOperation({ summary: "Add an email address to an account without one" })
  @ApiResponse({ status: 200, description: "Code sent" })
  addEmail(@Req() request: IAuthorizedRequest, @Body() dto: AddEmailDto) {
    return this.authService.startEmailAdd(request.user, dto);
  }

  @Post("/email/confirm")
  @UseGuards(AuthGuard("jwt"))
  @Throttle(SIGN_IN_THROTTLE)
  @ApiOperation({ summary: "Confirm the added email address with its code" })
  @ApiResponse({ status: 200, description: "Email confirmed" })
  confirmEmail(
    @Req() request: IAuthorizedRequest,
    @Body() dto: ConfirmEmailDto
  ) {
    return this.authService.confirmEmailAdd(request.user, dto);
  }

  @Get("/two-factor")
  @UseGuards(AuthGuard("jwt"))
  @ApiOperation({ summary: "The two-factor method of the signed-in account" })
  @ApiResponse({ status: 200, description: "Method" })
  getTwoFactor(@Req() request: IAuthorizedRequest) {
    return this.twoFactorService.status(request.user);
  }

  @Post("/two-factor/setup")
  @UseGuards(AuthGuard("jwt"))
  @ApiOperation({ summary: "Start enabling e-mail or app two-factor sign-in" })
  @ApiResponse({ status: 200, description: "Setup started" })
  setupTwoFactor(
    @Req() request: IAuthorizedRequest,
    @Body() dto: TwoFactorSetupDto
  ) {
    return this.twoFactorService.setup(request.user, dto);
  }

  @Post("/two-factor/confirm")
  @UseGuards(AuthGuard("jwt"))
  @ApiOperation({ summary: "Confirm the pending two-factor setup with a code" })
  @ApiResponse({ status: 200, description: "Two-factor enabled" })
  confirmTwoFactor(
    @Req() request: IAuthorizedRequest,
    @Body() dto: TwoFactorConfirmDto
  ) {
    return this.twoFactorService.confirm(request.user, dto);
  }

  @Post("/two-factor/disable/request")
  @UseGuards(AuthGuard("jwt"))
  @ApiOperation({ summary: "Request the code that turns two-factor sign-in off" })
  @ApiResponse({ status: 200, description: "Code sent" })
  requestDisableTwoFactor(@Req() request: IAuthorizedRequest) {
    return this.twoFactorService.requestDisableCode(request.user);
  }

  @Post("/two-factor/disable")
  @UseGuards(AuthGuard("jwt"))
  @ApiOperation({ summary: "Turn two-factor sign-in off with a code" })
  @ApiResponse({ status: 200, description: "Two-factor disabled" })
  disableTwoFactor(
    @Req() request: IAuthorizedRequest,
    @Body() dto: TwoFactorDisableDto
  ) {
    return this.twoFactorService.disable(request.user, dto);
  }

  @Post("/refresh-token")
  @UseGuards(JwtRefreshGuard)
  @ApiOperation({ summary: "Refresh token" })
  @ApiResponse({ status: 200, description: "Refresh successful" })
  async refreshToken(
    @Res() res: Response,
    @Req() req: Request,
    @Headers() headers?: any
  ): Promise<Response> {
    const oldRefreshToken = req.cookies.refreshMoonToken;

    if (oldRefreshToken) {
      const payload = this.jwtService.verify(oldRefreshToken, {
        secret: process.env.JWT_SECRET,
      });

      const userId = payload.id;

      try {
        const { accessToken, refreshToken } =
          await this.authService.refreshToken(userId);
        this.authService.setCookies(
          res,
          accessToken,
          refreshToken,
          headers?.origin
        );
      } catch (err) {
        if (err instanceof UnauthorizedException) {
          this.authService.clearCookies(res, headers?.origin);
        }
        throw err;
      }
      return res.status(HttpStatus.OK).json({ userId });
    } else
      throw new UnauthorizedException("No session to refresh. Sign in again.");
  }

  @Post(":id/logout")
  @ApiOperation({ summary: "User logout" })
  @ApiResponse({ status: 200, description: "Logout successful" })
  async logout(
    @Param("id") userId: string,
    @Res() res: Response,
    @Headers() headers: any
  ): Promise<Response> {
    this.authService.clearCookies(res, headers?.origin);

    await this.authService.logout(userId);

    return res
      .status(HttpStatus.OK)
      .json({ message: "Successfully logged out" });
  }
}
