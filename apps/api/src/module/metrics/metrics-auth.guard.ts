import { createHash, timingSafeEqual } from "node:crypto";
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

const digest = (value: string) => createHash("sha256").update(value).digest();

@Injectable()
export class MetricsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const token = process.env.METRICS_TOKEN;
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;

    if (
      !token ||
      !timingSafeEqual(digest(header ?? ""), digest(`Bearer ${token}`))
    ) {
      throw new UnauthorizedException("A valid metrics token is required");
    }

    return true;
  }
}
