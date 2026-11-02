import { createZodDto } from "nestjs-zod";
import {
  SendTestLetterRequestSchema,
  SendTestLetterResponseSchema,
} from "@mooncellar/schemas";

export class SendTestLetterDto extends createZodDto(
  SendTestLetterRequestSchema
) {}
export class SendTestLetterResponseDto extends createZodDto(
  SendTestLetterResponseSchema
) {}
