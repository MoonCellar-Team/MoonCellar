import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { IGameAccount } from "@mooncellar/schemas";
import type { Request } from "express";
import { AccountService } from "./account.service";

export type IGameRequest = Request & {
  account: IGameAccount;
  gameToken: string;
};

export const bearerToken = (request: Request) => {
  const header = request.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
};

@Injectable()
export class GameTokenGuard implements CanActivate {
  constructor(private readonly accounts: AccountService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<IGameRequest>();
    const token = bearerToken(request);
    if (!token) {
      throw new UnauthorizedException("Sign in to MoonCellar in the game");
    }
    const account = await this.accounts.accountOf(token, request.ip ?? "");
    if (!account) {
      throw new UnauthorizedException(
        "This game is signed out. Sign in to MoonCellar again"
      );
    }
    request.account = account;
    request.gameToken = token;
    return true;
  }
}
