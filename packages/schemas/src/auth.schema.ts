import { z } from "zod";

export const TWO_FACTOR_METHODS = ["off", "email", "app"] as const;
export const TwoFactorMethodSchema = z.enum(TWO_FACTOR_METHODS);
export const TwoFactorSetupMethodSchema = z.enum(["email", "app"]);

const emailSchema = z.string().trim().pipe(z.string().email());

export const SignUpResponseSchema = z.object({
  userId: z.string(),
  email: z.string(),
});

export const VerifyEmailRequestSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, "The code is 6 digits"),
});

export const ResendEmailCodeRequestSchema = z.object({
  email: emailSchema,
});

export const ResendEmailCodeResponseSchema = z.object({
  email: z.string(),
  resendInSeconds: z.number().int().nonnegative(),
});

export const LoginSuccessResponseSchema = z.object({
  userId: z.string(),
});

export const TwoFactorRequiredResponseSchema = z.object({
  twoFactorRequired: z.literal(true),
  method: z.enum(["email", "app"]),
});

export const TwoFactorVerifyRequestSchema = z.object({
  email: emailSchema,
  code: z.string().min(1).max(128),
});

export const TwoFactorStatusSchema = z.object({
  method: TwoFactorMethodSchema,
});

export const TwoFactorSetupRequestSchema = z.object({
  method: TwoFactorSetupMethodSchema,
});

export const TwoFactorAppSetupResponseSchema = z.object({
  secret: z.string(),
  otpauthUri: z.string(),
});

export const TwoFactorEmailSetupResponseSchema = z.object({
  method: z.literal("email"),
  pending: z.literal(true),
});

export const TwoFactorConfirmRequestSchema = z.object({
  code: z.string().min(1).max(128),
});

export const TwoFactorConfirmResponseSchema = z.object({
  method: TwoFactorMethodSchema,
  backupCodes: z.string().array().optional(),
});

export const TwoFactorDisableRequestSchema = z.object({
  code: z.string().min(1).max(128),
});

export const TwoFactorTicketRequestSchema = z.object({
  ticket: z.string().min(1),
  code: z.string().min(1).max(128),
});

export const OAUTH_PROVIDERS = ["google", "github", "reddit"] as const;
export const OAuthProviderSchema = z.enum(OAUTH_PROVIDERS);

export const OAuthAccountSchema = z.object({
  provider: OAuthProviderSchema,
  providerId: z.string(),
  providerUserName: z.string().nullable(),
  linkedAt: z.string(),
});

export const OAuthAccountsSchema = z.object({
  providers: OAuthProviderSchema.array().describe(
    "Providers this server can sign in with"
  ),
  linked: OAuthAccountSchema.array(),
  hasPassword: z.boolean(),
  email: z.string().nullable(),
});

export const AddEmailRequestSchema = z.object({
  email: emailSchema,
});

export const ConfirmEmailRequestSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "The code is 6 digits"),
});

export const AddEmailResponseSchema = z.object({
  email: z.string(),
  resendInSeconds: z.number().int().nonnegative(),
});

export type ITwoFactorMethod = z.infer<typeof TwoFactorMethodSchema>;
export type ISignUpResponse = z.infer<typeof SignUpResponseSchema>;
export type IVerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;
export type IResendEmailCodeRequest = z.infer<typeof ResendEmailCodeRequestSchema>;
export type IResendEmailCodeResponse = z.infer<
  typeof ResendEmailCodeResponseSchema
>;
export type ILoginSuccessResponse = z.infer<typeof LoginSuccessResponseSchema>;
export type ITwoFactorRequiredResponse = z.infer<
  typeof TwoFactorRequiredResponseSchema
>;
export type ITwoFactorVerifyRequest = z.infer<typeof TwoFactorVerifyRequestSchema>;
export type ITwoFactorStatus = z.infer<typeof TwoFactorStatusSchema>;
export type ITwoFactorSetupRequest = z.infer<typeof TwoFactorSetupRequestSchema>;
export type ITwoFactorAppSetupResponse = z.infer<
  typeof TwoFactorAppSetupResponseSchema
>;
export type ITwoFactorEmailSetupResponse = z.infer<
  typeof TwoFactorEmailSetupResponseSchema
>;
export type ITwoFactorConfirmRequest = z.infer<
  typeof TwoFactorConfirmRequestSchema
>;
export type ITwoFactorConfirmResponse = z.infer<
  typeof TwoFactorConfirmResponseSchema
>;
export type ITwoFactorDisableRequest = z.infer<
  typeof TwoFactorDisableRequestSchema
>;
export type ITwoFactorTicketRequest = z.infer<
  typeof TwoFactorTicketRequestSchema
>;
export type IOAuthProvider = z.infer<typeof OAuthProviderSchema>;
export type IOAuthAccount = z.infer<typeof OAuthAccountSchema>;
export type IOAuthAccounts = z.infer<typeof OAuthAccountsSchema>;
export type IAddEmailRequest = z.infer<typeof AddEmailRequestSchema>;
export type IAddEmailResponse = z.infer<typeof AddEmailResponseSchema>;
export type IConfirmEmailRequest = z.infer<typeof ConfirmEmailRequestSchema>;
