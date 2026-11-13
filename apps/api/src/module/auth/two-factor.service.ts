import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";
import type {
  ITwoFactorConfirmRequest,
  ITwoFactorConfirmResponse,
  ITwoFactorEmailSetupResponse,
  ITwoFactorAppSetupResponse,
  ITwoFactorSetupRequest,
  ITwoFactorStatus,
} from "@mooncellar/schemas";
import { User } from "../user/schemas/user.schema";
import { MailService } from "../mail/mail.service";
import { buildTwoFactorCodeLetter } from "../mail/mail.letter";
import { generateTotpSecret, verifyTotpCode, buildOtpauthUri } from "./totp";
import { decryptSecret, encryptSecret, sha256, twoFactorKey } from "./two-factor-crypto";
import {
  buildEmailCodeFields,
  emailCodeAttemptsExhausted,
  emailCodeIsExpired,
  emailCodeMatches,
  newBackupCodes,
  newEmailCode,
} from "./auth-codes";

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly mail: MailService,
    private readonly config: ConfigService
  ) {}

  private secretKey(): string {
    const secret = this.config.get<string>("JWT_SECRET");
    if (!secret) {
      throw new ServiceUnavailableException(
        "Two-factor authentication is not configured on this server"
      );
    }
    return twoFactorKey(secret);
  }

  async status(user: User): Promise<ITwoFactorStatus> {
    return { method: (user.twoFactor?.method ?? "off") as ITwoFactorStatus["method"] };
  }

  async setup(
    user: User,
    { method }: ITwoFactorSetupRequest
  ): Promise<ITwoFactorAppSetupResponse | ITwoFactorEmailSetupResponse> {
    if (method === "app") {
      const secret = generateTotpSecret();
      user.twoFactor = {
        method: user.twoFactor?.method ?? "off",
        pendingMethod: "app",
        totpSecretEncrypted: encryptSecret(secret, this.secretKey()),
        backupCodes: user.twoFactor?.backupCodes ?? [],
        backupCodesGeneratedAt: user.twoFactor?.backupCodesGeneratedAt ?? null,
      };
      user.markModified("twoFactor");
      await user.save();

      return { secret, otpauthUri: buildOtpauthUri(secret, user.email) };
    }

    this.assertEmailCodeCanResend(user);
    const code = newEmailCode();
    user.twoFactorCode = buildEmailCodeFields(code);
    if (!user.twoFactor || user.twoFactor.method === "off") {
      user.twoFactor = {
        method: user.twoFactor?.method ?? "off",
        pendingMethod: "email",
        totpSecretEncrypted: null,
        backupCodes: [],
        backupCodesGeneratedAt: null,
      };
    } else {
      user.twoFactor.pendingMethod = "email";
    }
    user.markModified("twoFactorCode");
    user.markModified("twoFactor");
    await user.save();
    this.sendCodeEmail(user.email, code);

    return { method: "email", pending: true };
  }

  async confirm(
    user: User,
    { code }: ITwoFactorConfirmRequest
  ): Promise<ITwoFactorConfirmResponse> {
    const pending = user.twoFactor?.pendingMethod;
    if (!pending) {
      throw new BadRequestException("No two-factor setup is pending");
    }

    if (pending === "app") {
      const encrypted = user.twoFactor?.totpSecretEncrypted;
      if (!encrypted) {
        throw new BadRequestException("Start the authenticator setup again");
      }
      const secret = decryptSecret(encrypted, this.secretKey());
      if (!verifyTotpCode(secret, code)) {
        throw new BadRequestException("The code does not match");
      }

      const backupCodes = newBackupCodes();
      user.twoFactor = {
        method: "app",
        pendingMethod: null,
        totpSecretEncrypted: encrypted,
        backupCodes: backupCodes.map(sha256),
        backupCodesGeneratedAt: new Date(),
      };
      user.markModified("twoFactor");
      await user.save();

      return { method: "app", backupCodes };
    }

    if (
      emailCodeIsExpired(user.twoFactorCode) ||
      emailCodeAttemptsExhausted(user.twoFactorCode)
    ) {
      throw new BadRequestException(
        "The code is invalid or expired. Request a new one."
      );
    }

    const record = user.twoFactorCode!;
    const matches = emailCodeMatches(record, code);
    record.attempts += 1;
    user.markModified("twoFactorCode");
    await user.save();

    if (!matches) {
      throw new BadRequestException("The code does not match");
    }

    user.twoFactor = {
      method: "email",
      pendingMethod: null,
      totpSecretEncrypted: null,
      backupCodes: [],
      backupCodesGeneratedAt: null,
    };
    user.twoFactorCode = null;
    user.markModified("twoFactor");
    user.markModified("twoFactorCode");
    await user.save();

    return { method: "email" };
  }

  async requestDisableCode(
    user: User
  ): Promise<{ method: "email" | "app" }> {
    const method = user.twoFactor?.method ?? "off";
    if (method === "off") {
      throw new BadRequestException("Two-factor sign-in is not enabled");
    }

    if (method === "email") {
      this.assertEmailCodeCanResend(user);
      const code = newEmailCode();
      user.twoFactorCode = buildEmailCodeFields(code);
      user.markModified("twoFactorCode");
      await user.save();
      this.sendCodeEmail(user.email, code);
    }

    return { method: method as "email" | "app" };
  }

  async disable(user: User, { code }: { code: string }) {
    const method = user.twoFactor?.method ?? "off";
    if (method === "off") {
      throw new BadRequestException("Two-factor sign-in is not enabled");
    }

    if (method === "email") {
      if (
        emailCodeIsExpired(user.twoFactorCode) ||
        emailCodeAttemptsExhausted(user.twoFactorCode)
      ) {
        throw new BadRequestException(
          "The code is invalid or expired. Request a new one."
        );
      }
      const record = user.twoFactorCode!;
      const matches = emailCodeMatches(record, code);
      record.attempts += 1;
      user.markModified("twoFactorCode");
      await user.save();
      if (!matches) {
        throw new BadRequestException("The code does not match");
      }
    } else {
      const encrypted = user.twoFactor?.totpSecretEncrypted;
      const totpOk =
        !!encrypted &&
        verifyTotpCode(decryptSecret(encrypted, this.secretKey()), code);
      const backupOk = this.consumeBackupCode(user, code);
      if (!totpOk && !backupOk) {
        throw new BadRequestException("The code does not match");
      }
    }

    user.twoFactor = null;
    user.twoFactorCode = null;
    user.markModified("twoFactor");
    user.markModified("twoFactorCode");
    await user.save();

    return { method: "off" };
  }

  private consumeBackupCode(user: User, code: string): boolean {
    const normalized = code.replace(/[\s-]/g, "").toUpperCase();
    const hash = sha256(normalized);
    const codes = user.twoFactor?.backupCodes ?? [];
    const index = codes.indexOf(hash);
    if (index === -1) return false;

    user.twoFactor!.backupCodes.splice(index, 1);
    user.markModified("twoFactor");
    return true;
  }

  private assertEmailCodeCanResend(user: User): void {
    const resendAt = user.twoFactorCode?.resendAt;
    if (resendAt && resendAt.getTime() > Date.now()) {
      const seconds = Math.ceil((resendAt.getTime() - Date.now()) / 1000);
      throw new BadRequestException(`Try again in ${seconds} seconds`);
    }
  }

  private sendCodeEmail(to: string, code: string): void {
    this.mail
      .send({ to, subject: "Your sign-in code", letter: buildTwoFactorCodeLetter(code) })
      .catch((err) =>
        this.logger.error(err, `Failed to send a sign-in code to ${to}`)
      );
  }
}
