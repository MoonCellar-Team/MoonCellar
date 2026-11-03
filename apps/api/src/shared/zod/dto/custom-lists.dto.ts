import { createZodDto } from "nestjs-zod";
import {
  AddCustomListGameRequestSchema,
  CreateCustomListRequestSchema,
  CustomListDetailsSchema,
  CustomListLikeResponseSchema,
  CustomListSchema,
  FilterCustomListBySlugRequestSchema,
  GameListsResponseSchema,
  GetCustomListBySlugRequestSchema,
  GetCustomListsRequestSchema,
  GetCustomListsResponseSchema,
  GetUserCustomListsRequestSchema,
  ReorderCustomListRequestSchema,
  ReorderCustomListsRequestSchema,
  UpdateCustomListRequestSchema,
} from "@mooncellar/schemas";

export class GetCustomListsRequestDto extends createZodDto(
  GetCustomListsRequestSchema
) {}

export class GetCustomListsResponseDto extends createZodDto(
  GetCustomListsResponseSchema
) {}

export class GetUserCustomListsRequestDto extends createZodDto(
  GetUserCustomListsRequestSchema
) {}

export class GetCustomListBySlugRequestDto extends createZodDto(
  GetCustomListBySlugRequestSchema
) {}

export class FilterCustomListBySlugRequestDto extends createZodDto(
  FilterCustomListBySlugRequestSchema
) {}

export class CustomListResponseDto extends createZodDto(CustomListSchema) {}

export class CustomListDetailsResponseDto extends createZodDto(
  CustomListDetailsSchema
) {}

export class CustomListLikeResponseDto extends createZodDto(
  CustomListLikeResponseSchema
) {}

export class CreateCustomListRequestDto extends createZodDto(
  CreateCustomListRequestSchema
) {}

export class UpdateCustomListRequestDto extends createZodDto(
  UpdateCustomListRequestSchema
) {}

export class AddCustomListGameRequestDto extends createZodDto(
  AddCustomListGameRequestSchema
) {}

export class ReorderCustomListRequestDto extends createZodDto(
  ReorderCustomListRequestSchema
) {}

export class ReorderCustomListsRequestDto extends createZodDto(
  ReorderCustomListsRequestSchema
) {}

export class GameListsResponseDto extends createZodDto(
  GameListsResponseSchema
) {}
