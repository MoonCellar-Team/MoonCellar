import { createZodDto } from "nestjs-zod";
import {
  AddEmailRequestSchema,
  ConfirmEmailRequestSchema,
  ResendEmailCodeRequestSchema,
  TwoFactorConfirmRequestSchema,
  TwoFactorDisableRequestSchema,
  TwoFactorSetupRequestSchema,
  TwoFactorTicketRequestSchema,
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

export class TwoFactorTicketDto extends createZodDto(
  TwoFactorTicketRequestSchema
) {}
export class AddEmailDto extends createZodDto(AddEmailRequestSchema) {}
export class ConfirmEmailDto extends createZodDto(ConfirmEmailRequestSchema) {}
