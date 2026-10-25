import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { isBearerToken } from "../../shared/bearer-token";

// Moderation of player levels has no MoonCellar role behind it yet: it takes the service's own
// `MODERATION_TOKEN`, as /metrics takes METRICS_TOKEN. Without the variable nobody moderates.
@Injectable()
export class ModerationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const token = process.env.MODERATION_TOKEN;
    const header: string | undefined = context.switchToHttp().getRequest()
      .headers?.authorization;
    if (!isBearerToken(header, token)) {
      throw new UnauthorizedException("A valid moderation token is required");
    }
    return true;
  }
}
