import { createZodDto } from "nestjs-zod";
import { GameCommunitySchema } from "@mooncellar/schemas";

export class GetGameCommunityResponseDto extends createZodDto(
  GameCommunitySchema
) {}
