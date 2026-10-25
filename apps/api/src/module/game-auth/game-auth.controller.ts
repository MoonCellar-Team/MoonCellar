import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  GameDeviceApproveRequestDto,
  GameDeviceCodeDto,
  GameDeviceCodeRequestDto,
  GameDeviceLinkDto,
  GameDeviceTokenDto,
  GameDeviceTokenRequestDto,
  GameSessionDto,
  GameTokenIntrospectionDto,
  GameTokenRequestDto,
} from "../../shared/zod/dto/game-auth.dto";
import type { IAuthorizedRequest } from "../comments/types/community.type";
import { GameAuthService } from "./game-auth.service";
import {
  DEVICE_POLL_THROTTLE,
  DEVICE_SIGN_IN_THROTTLE,
  INTROSPECT_THROTTLE,
} from "../../shared/throttle";

@ApiTags("Game sign-in")
@Controller("auth/game")
export class GameAuthController {
  constructor(private readonly gameAuth: GameAuthService) {}

  @Post("device")
  @Throttle(DEVICE_SIGN_IN_THROTTLE)
  @ApiOperation({
    summary: "Start signing in a game device: a code to confirm on the site",
  })
  @ApiOkResponse({ type: GameDeviceCodeDto })
  @HttpCode(HttpStatus.OK)
  createDeviceCode(@Body() dto: GameDeviceCodeRequestDto) {
    return this.gameAuth.createDeviceCode(dto.deviceName);
  }

  @Post("device/token")
  @Throttle(DEVICE_POLL_THROTTLE)
  @ApiOperation({
    summary: "Poll a device code: pending until confirmed, then the game token",
  })
  @ApiOkResponse({ type: GameDeviceTokenDto })
  @HttpCode(HttpStatus.OK)
  exchange(@Body() dto: GameDeviceTokenRequestDto) {
    return this.gameAuth.exchange(dto.deviceCode);
  }

  @Get("device/:userCode")
  @Throttle(DEVICE_SIGN_IN_THROTTLE)
  @ApiOperation({ summary: "The device waiting for this code" })
  @ApiOkResponse({ type: GameDeviceLinkDto })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"))
  getLink(@Param("userCode") userCode: string) {
    return this.gameAuth.getLink(userCode);
  }

  @Post("device/approve")
  @Throttle(DEVICE_SIGN_IN_THROTTLE)
  @ApiOperation({ summary: "Confirm a device code with the signed-in account" })
  @ApiOkResponse({ type: GameDeviceLinkDto })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(HttpStatus.OK)
  approve(
    @Body() dto: GameDeviceApproveRequestDto,
    @Req() request: IAuthorizedRequest
  ) {
    return this.gameAuth.approve(dto.userCode, request.user);
  }

  @Get("sessions")
  @ApiOperation({ summary: "Game devices signed in to the account" })
  @ApiOkResponse({ type: [GameSessionDto] })
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"))
  listSessions(@Req() request: IAuthorizedRequest) {
    return this.gameAuth.listSessions(request.user);
  }

  @Delete("sessions/:id")
  @ApiOperation({ summary: "Sign a game device out" })
  @ApiNoContentResponse()
  @ApiCookieAuth()
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @Param("id") id: string,
    @Req() request: IAuthorizedRequest
  ) {
    await this.gameAuth.revokeSession(request.user, id);
  }

  @Post("token/introspect")
  @Throttle(INTROSPECT_THROTTLE)
  @ApiOperation({ summary: "Whether a game token is active, and whose it is" })
  @ApiOkResponse({ type: GameTokenIntrospectionDto })
  @HttpCode(HttpStatus.OK)
  introspect(@Body() dto: GameTokenRequestDto) {
    return this.gameAuth.introspect(dto.token);
  }

  @Post("token/revoke")
  @ApiOperation({ summary: "Sign out from the game itself" })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Body() dto: GameTokenRequestDto) {
    await this.gameAuth.revokeByToken(dto.token);
  }
}
