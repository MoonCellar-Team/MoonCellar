import { createZodDto } from "nestjs-zod";
import {
  ResendEmailCodeRequestSchema,
  TwoFactorConfirmRequestSchema,
  TwoFactorDisableRequestSchema,
  TwoFactorSetupRequestSchema,
  TwoFactorVerifyRequestSchema,
  VerifyEmailRequestSchema,
} from "@mooncellar/schemas";

export class VerifyEmailDto extends createZodDto(VerifyEmailRequestSchema) {}
export class ResendEmailCodeDto extends createZodDto(
  ResendEmailCodeRequestSchema
) {}
export class TwoFactorVerifyDto extends createZodDto(
  TwoFactorVerifyRequestSchema
) {}
export class TwoFactorSetupDto extends createZodDto(
  TwoFactorSetupRequestSchema
) {}
export class TwoFactorConfirmDto extends createZodDto(
  TwoFactorConfirmRequestSchema
) {}
export class TwoFactorDisableDto extends createZodDto(
  TwoFactorDisableRequestSchema
) {}
