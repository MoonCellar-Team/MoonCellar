import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  type OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { SignUpDto } from "./dto/signup.dto";
import { InjectModel } from "@nestjs/mongoose";
import { User } from "../user/schemas/user.schema";
import { Model } from "mongoose";
import * as bcrypt from "bcryptjs";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { BusinessMetricsService } from "../metrics/business-metrics.service";
import { LoginDto } from "./dto/login.dto";
import { type Response } from "express";
import {
  ACCESS_TOKEN,
  accessExpire,
  FRONT_URL,
  REFRESH_TOKEN,
  refreshExpire,
} from "../../shared/constants";
import { IndexNowService } from "../indexnow/indexnow.service";
import { clearAuthCookies, getAuthCookieOptions } from "./auth-cookies";
import { MailService } from "../mail/mail.service";
import {
  buildTwoFactorCodeLetter,
  buildVerificationCodeLetter,
} from "../mail/mail.letter";
import { decryptSecret, sha256, twoFactorKey } from "./two-factor-crypto";
import { verifyTotpCode } from "./totp";
import {
  EMAIL_CODE_RESEND_COOLDOWN_MS,
  buildEmailCodeFields,
  emailCodeAttemptsExhausted,
  emailCodeIsExpired,
  emailCodeMatches,
  newEmailCode,
} from "./auth-codes";
import type {
  IAddEmailRequest,
  IAddEmailResponse,
  IConfirmEmailRequest,
  IResendEmailCodeRequest,
  IResendEmailCodeResponse,
  ITwoFactorTicketRequest,
  ITwoFactorVerifyRequest,
  IVerifyEmailRequest,
} from "@mooncellar/schemas";
import { ensurePartialEmailIndex } from "./user-email-index";
import { TWO_FACTOR_TICKET_SCOPE, TWO_FACTOR_TICKET_TTL_MS } from "./oauth/oauth.types";

export type TSignedIn = {
  accessToken: string;
  refreshToken: string;
  userId: string;
};

type TLoginResult =
  | TSignedIn
  | { twoFactorRequired: true; method: "email" | "app" };

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly metrics: BusinessMetricsService,
    private readonly indexNow: IndexNowService,
    private readonly mail: MailService
  ) {}

  async onModuleInit(): Promise<void> {
    await ensurePartialEmailIndex(this.userModel).catch((error) =>
      this.logger.error(
        error,
        "Could not make the user email index partial"
      )
    );
  }

  async generateTokensAndUpdateUser(
    user: User
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const accessToken = this.jwtService.sign(
        {
          id: user._id,
          roles: user.roles,
          userName: user.userName,
          email: user.email,
        },
        { expiresIn: accessExpire }
      );
      const refreshToken = this.jwtService.sign(
        { id: user._id },
        { expiresIn: refreshExpire }
      );

      user.refreshToken = refreshToken;
      await user.save();

      return { accessToken, refreshToken };
    } catch (err) {
      this.logger.error(err, "Failed to generate tokens");
      throw err;
    }
  }

  async signUp(signUpDto: SignUpDto): Promise<{ userId: string; email: string }> {
    try {
      const { userName, email, password } = signUpDto;
      const isEmailExists = await this.userModel.findOne({ email });
      const isUserExists = await this.userModel.findOne({ userName });

      if (isEmailExists) throw new ConflictException("Email already exists");
      if (isUserExists) throw new ConflictException("UserName already exists");

      const hashedPassword = await bcrypt.hash(password, 10);
      const code = newEmailCode();

      const user = await this.userModel.create({
        userName,
        email,
        password: hashedPassword,
        emailVerified: false,
        verificationCode: buildEmailCodeFields(code),
      });

      this.metrics.recordRegistration();
      this.indexNow.submitUrl(`${FRONT_URL}/user/${user.userName}`);
      this.sendVerificationEmail(user.email, code);

      return { userId: String(user._id), email: user.email };
    } catch (err) {
      if (
        err instanceof ConflictException ||
        err instanceof BadRequestException ||
        err instanceof UnauthorizedException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      this.logger.error(err, "Failed to sign up");
      throw err;
    }
  }

  async verifyEmail({
    email,
    code,
  }: IVerifyEmailRequest): Promise<TSignedIn> {
    const user = await this.userModel.findOne({ email });
    if (!user) throw new BadRequestException("Email does not exist");
    if (user.emailVerified !== false) {
      throw new BadRequestException("Email is already confirmed");
    }

    if (
      emailCodeIsExpired(user.verificationCode) ||
      emailCodeAttemptsExhausted(user.verificationCode)
    ) {
      throw new BadRequestException(
        "The code has expired or was tried too many times. Request a new one."
      );
    }

    const record = user.verificationCode!;
    const matches = emailCodeMatches(record, code);
    record.attempts += 1;
    user.markModified("verificationCode");
    await user.save();

    if (!matches) throw new BadRequestException("The code does not match");

    user.emailVerified = true;
    user.verificationCode = null;
    user.markModified("verificationCode");

    const tokens = await this.generateTokensAndUpdateUser(user);
    return { ...tokens, userId: String(user._id) };
  }

  async resendVerificationCode({
    email,
  }: IResendEmailCodeRequest): Promise<IResendEmailCodeResponse> {
    const user = await this.userModel.findOne({ email });
    if (!user) throw new BadRequestException("Email does not exist");
    if (user.emailVerified !== false) {
      throw new BadRequestException("Email is already confirmed");
    }

    const resendAt = user.verificationCode?.resendAt;
    if (resendAt && resendAt.getTime() > Date.now()) {
      const seconds = Math.ceil((resendAt.getTime() - Date.now()) / 1000);
      throw new BadRequestException(`Try again in ${seconds} seconds`);
    }

    const code = newEmailCode();
    user.verificationCode = buildEmailCodeFields(code);
    user.markModified("verificationCode");
    await user.save();
    this.sendVerificationEmail(user.email, code);

    return {
      email: user.email,
      resendInSeconds: EMAIL_CODE_RESEND_COOLDOWN_MS / 1000,
    };
  }

  async startEmailAdd(
    user: User,
    { email }: IAddEmailRequest
  ): Promise<IAddEmailResponse> {
    if (user.email && user.emailVerified !== false) {
      throw new BadRequestException(
        "Your account already has an email address"
      );
    }

    const taken = await this.userModel.findOne({ email });
    if (taken && String(taken._id) !== String(user._id)) {
      throw new ConflictException("Email already exists");
    }

    const resendAt = user.verificationCode?.resendAt;
    if (resendAt && resendAt.getTime() > Date.now()) {
      const seconds = Math.ceil((resendAt.getTime() - Date.now()) / 1000);
      throw new BadRequestException(`Try again in ${seconds} seconds`);
    }

    const code = newEmailCode();
    user.email = email;
    user.emailVerified = false;
    user.verificationCode = buildEmailCodeFields(code);
    user.markModified("verificationCode");
    await user.save();
    this.sendVerificationEmail(email, code);

    return {
      email,
      resendInSeconds: EMAIL_CODE_RESEND_COOLDOWN_MS / 1000,
    };
  }

  async confirmEmailAdd(
    user: User,
    { code }: IConfirmEmailRequest
  ): Promise<{ email: string }> {
    if (!user.email) {
      throw new BadRequestException("Add an email address first");
    }

    if (user.emailVerified !== false) {
      throw new BadRequestException("Email is already confirmed");
    }

    if (
      emailCodeIsExpired(user.verificationCode) ||
      emailCodeAttemptsExhausted(user.verificationCode)
    ) {
      throw new BadRequestException(
        "The code has expired or was tried too many times. Request a new one."
      );
    }

    const record = user.verificationCode!;
    const matches = emailCodeMatches(record, code);
    record.attempts += 1;
    user.markModified("verificationCode");
    await user.save();

    if (!matches) throw new BadRequestException("The code does not match");

    user.emailVerified = true;
    user.verificationCode = null;
    user.markModified("verificationCode");
    await user.save();

    return { email: user.email };
  }

  async login(loginDto: LoginDto): Promise<TLoginResult> {
    const { email, password } = loginDto;
    const user = await this.userModel.findOne({ email });

    if (!user) throw new BadRequestException("Email does not exists");

    if (user.emailVerified === false) {
      throw new ForbiddenException(
        "Confirm your email before signing in. Check your inbox for the code."
      );
    }

    if (!user.password) {
      throw new BadRequestException(
        "This account signs in with Google, GitHub or Reddit. Use one of those buttons."
      );
    }

    const isPasswordMatched = await bcrypt.compare(password, user.password);

    if (!isPasswordMatched)
      throw new BadRequestException("Password does not match");

    const method = await this.startTwoFactorChallenge(user);
    if (method !== "off") return { twoFactorRequired: true, method };

    const tokens = await this.generateTokensAndUpdateUser(user);
    return { ...tokens, userId: String(user._id) };
  }

  async startTwoFactorChallenge(
    user: User
  ): Promise<"off" | "email" | "app"> {
    const method = user.twoFactor?.method ?? "off";

    if (method === "email") {
      const code = newEmailCode();
      user.twoFactorCode = buildEmailCodeFields(code);
      user.markModified("twoFactorCode");
      await user.save();
      this.sendTwoFactorEmail(user.email, code);
    }

    return method as "off" | "email" | "app";
  }

  async completeTwoFactor(user: User, code: string): Promise<void> {
    const method = user.twoFactor?.method ?? "off";

    if (method === "off") {
      throw new BadRequestException("Two-factor sign-in is not enabled");
    }

    const valid = await this.verifyTwoFactorCode(
      user,
      method as "email" | "app",
      code
    );

    if (!valid) throw new BadRequestException("The code does not match");
  }

  createTwoFactorTicket(user: User): string {
    return this.jwtService.sign(
      { id: String(user._id), scope: TWO_FACTOR_TICKET_SCOPE },
      { expiresIn: Math.floor(TWO_FACTOR_TICKET_TTL_MS / 1000) }
    );
  }

  async verifyTwoFactorTicket({
    ticket,
    code,
  }: ITwoFactorTicketRequest): Promise<TSignedIn> {
    let payload: { id?: string; scope?: string };

    try {
      payload = this.jwtService.verify<{ id?: string; scope?: string }>(ticket);
    } catch {
      throw new UnauthorizedException(
        "The two-factor sign-in has expired. Sign in again."
      );
    }

    if (payload?.scope !== TWO_FACTOR_TICKET_SCOPE || !payload.id) {
      throw new UnauthorizedException(
        "The two-factor sign-in has expired. Sign in again."
      );
    }

    const user = await this.userModel.findById(payload.id);
    if (!user) {
      throw new UnauthorizedException(
        "The two-factor sign-in has expired. Sign in again."
      );
    }

    await this.completeTwoFactor(user, code);

    const tokens = await this.generateTokensAndUpdateUser(user);
    return { ...tokens, userId: String(user._id) };
  }

  async verifyTwoFactor({
    email,
    code,
  }: ITwoFactorVerifyRequest): Promise<TSignedIn> {
    const user = await this.userModel.findOne({ email });
    if (!user) throw new BadRequestException("Email does not exist");

    await this.completeTwoFactor(user, code);

    const tokens = await this.generateTokensAndUpdateUser(user);
    return { ...tokens, userId: String(user._id) };
  }

  private async verifyTwoFactorCode(
    user: User,
    method: "email" | "app",
    code: string
  ): Promise<boolean> {
    if (method === "email") {
      if (
        emailCodeIsExpired(user.twoFactorCode) ||
        emailCodeAttemptsExhausted(user.twoFactorCode)
      ) {
        return false;
      }

      const record = user.twoFactorCode!;
      const matches = emailCodeMatches(record, code);
      record.attempts += 1;
      user.markModified("twoFactorCode");
      await user.save();
      if (!matches) return false;

      user.twoFactorCode = null;
      user.markModified("twoFactorCode");
      await user.save();
      return true;
    }

    const encrypted = user.twoFactor?.totpSecretEncrypted;
    if (
      encrypted &&
      verifyTotpCode(decryptSecret(encrypted, this.twoFactorSecretKey()), code)
    ) {
      return true;
    }

    const normalized = code.replace(/[\s-]/g, "").toUpperCase();
    const hash = sha256(normalized);
    const codes = user.twoFactor?.backupCodes ?? [];
    const index = codes.indexOf(hash);
    if (index !== -1) {
      user.twoFactor!.backupCodes.splice(index, 1);
      user.markModified("twoFactor");
      await user.save();
      return true;
    }

    return false;
  }

  private twoFactorSecretKey(): string {
    const secret = this.config.get<string>("JWT_SECRET");
    if (!secret) {
      throw new ServiceUnavailableException(
        "Two-factor authentication is not configured on this server"
      );
    }
    return twoFactorKey(secret);
  }

  private sendVerificationEmail(to: string, code: string): void {
    this.mail
      .send({
        to,
        subject: "Confirm your email",
        letter: buildVerificationCodeLetter(code),
      })
      .catch((err) =>
        this.logger.error(err, `Failed to send a verification code to ${to}`)
      );
  }

  private sendTwoFactorEmail(to: string, code: string): void {
    this.mail
      .send({
        to,
        subject: "Your sign-in code",
        letter: buildTwoFactorCodeLetter(code),
      })
      .catch((err) =>
        this.logger.error(err, `Failed to send a sign-in code to ${to}`)
      );
  }

  async refreshToken(userId: string) {
    const user = await this.userModel.findById(userId);

    if (!user?.refreshToken) {
      throw new UnauthorizedException("The session has ended. Sign in again.");
    }

    try {
      const newAccessToken = this.jwtService.sign(
        {
          id: user._id,
          roles: user.roles,
          userName: user.userName,
          email: user.email,
        },
        { expiresIn: accessExpire }
      );

      const newRefreshToken = this.jwtService.sign(
        { id: user._id },
        { expiresIn: refreshExpire }
      );
      user.refreshToken = newRefreshToken;
      await user.save();

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (err) {
      this.logger.error(err, "Failed to refresh token");
      throw err;
    }
  }

  setCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    origin?: string
  ): void {
    const options = getAuthCookieOptions(origin);

    res.cookie(ACCESS_TOKEN, accessToken, {
      ...options,
      expires: new Date(Date.now() + accessExpire),
      maxAge: accessExpire,
    });
    res.cookie(REFRESH_TOKEN, refreshToken, {
      ...options,
      expires: new Date(Date.now() + refreshExpire),
      maxAge: refreshExpire,
    });
  }

  clearCookies(res: Response, origin?: string): void {
    clearAuthCookies(res, origin);
  }

  async logout(userId: string): Promise<void> {
    try {
      const user = await this.userModel.findById(userId).orFail();
      if (user) {
        user.refreshToken = null;
        await user.save();
      }
    } catch (err) {
      this.logger.error(err, `Failed to logout: ${userId}`);
      throw err;
    }
  }
}
