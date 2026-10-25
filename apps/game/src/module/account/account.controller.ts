import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  GameAccountDto,
  GameDeviceCodeDto,
  GameDeviceCodeRequestDto,
  GameDeviceTokenDto,
  GameDeviceTokenRequestDto,
} from "../../shared/zod/dto/game.dto";
import { AccountService } from "./account.service";
import { GameTokenGuard, type IGameRequest } from "./game-token.guard";
import {
  DEVICE_POLL_THROTTLE,
  DEVICE_SIGN_IN_THROTTLE,
} from "../../shared/throttle";

@ApiTags("Account")
@Controller("account")
export class AccountController {
  constructor(private readonly accounts: AccountService) {}

  @Post("device")
  @Throttle(DEVICE_SIGN_IN_THROTTLE)
  @ApiOperation({
    summary: "Start signing in: a code to confirm at mooncellar.space/link",
  })
  @ApiOkResponse({ type: GameDeviceCodeDto })
  @HttpCode(HttpStatus.OK)
  startDeviceSignIn(@Body() dto: GameDeviceCodeRequestDto) {
    return this.accounts.startDeviceSignIn(dto.deviceName);
  }

  @Post("device/token")
  @Throttle(DEVICE_POLL_THROTTLE)
  @ApiOperation({
    summary: "Poll the sign-in: pending until confirmed, then the game token",
  })
  @ApiOkResponse({ type: GameDeviceTokenDto })
  @HttpCode(HttpStatus.OK)
  pollDeviceSignIn(@Body() dto: GameDeviceTokenRequestDto) {
    return this.accounts.pollDeviceSignIn(dto.deviceCode);
  }

  @Get("me")
  @ApiOperation({ summary: "The account this game is signed in with" })
  @ApiOkResponse({ type: GameAccountDto })
  @ApiBearerAuth()
  @UseGuards(GameTokenGuard)
  me(@Req() request: IGameRequest) {
    return request.account;
  }

  @Get("friends")
  @ApiOperation({
    summary: "Who this player can challenge: followings and followers",
  })
  @ApiOkResponse({ type: [GameAccountDto] })
  @ApiBearerAuth()
  @UseGuards(GameTokenGuard)
  friends(@Req() request: IGameRequest) {
    return this.accounts.friendsOf(request.account.id);
  }

  @Post("sign-out")
  @ApiOperation({ summary: "Sign this game out and revoke its token" })
  @ApiNoContentResponse()
  @ApiBearerAuth()
  @UseGuards(GameTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(@Req() request: IGameRequest) {
    await this.accounts.signOut(request.gameToken);
  }
}
