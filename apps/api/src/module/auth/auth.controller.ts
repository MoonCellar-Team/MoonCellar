import {
  Body,
  Controller,
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
import type { Request, Response } from "express";
import { UserProfileService } from "../user/services/user-profile.service";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { SignUpDto } from "./dto/signup.dto";
import { JwtRefreshGuard } from "./jwt-refresh.guard";
import { SIGN_IN_THROTTLE, SIGN_UP_THROTTLE } from "../../shared/throttle";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly authService: AuthService,
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
    @Res() res: Response,
    @Headers() headers: any
  ): Promise<Response> {
    const { accessToken, refreshToken } =
      await this.authService.signUp(signUpDto);
    const userId = (
      await this.userProfileService.findByString({
        searchString: signUpDto.userName,
      })
    )._id.toString();

    this.authService.setCookies(
      res,
      accessToken,
      refreshToken,
      headers?.origin
    );
    return res.status(HttpStatus.OK).json({ userId });
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
    const { accessToken, refreshToken } =
      await this.authService.login(loginDto);
    const userId = (
      await this.userProfileService.findByString({
        searchString: loginDto.email,
      })
    )._id.toString();

    this.authService.setCookies(
      res,
      accessToken,
      refreshToken,
      headers?.origin
    );

    return res.status(HttpStatus.OK).json({ userId });
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
