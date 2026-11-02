import { z } from "zod";

export const SendTestLetterRequestSchema = z.object({
  to: z.string().trim().toLowerCase().pipe(z.string().email()),
});

export const SendTestLetterResponseSchema = z.object({
  sent: z.boolean(),
  to: z.string(),
  subject: z.string(),
});

export type ISendTestLetterRequest = z.infer<
  typeof SendTestLetterRequestSchema
>;
export type ISendTestLetterResponse = z.infer<
  typeof SendTestLetterResponseSchema
>;
