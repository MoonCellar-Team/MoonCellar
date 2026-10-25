import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { isBearerToken } from "../../shared/bearer-token";

@Injectable()
export class MetricsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const token = process.env.METRICS_TOKEN;
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;

    if (!isBearerToken(header, token)) {
      throw new UnauthorizedException("A valid metrics token is required");
    }

    return true;
  }
}
