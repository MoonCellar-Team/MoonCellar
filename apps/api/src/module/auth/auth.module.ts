import { Module } from "@nestjs/common";
import { ActivityModule } from "../activity/activity.module";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { MongooseModule } from "@nestjs/mongoose";
import { UserSchema } from "../user/schemas/user.schema";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtStrategy } from "./jwt.strategy";
import { UserProfileController } from "../user/controllers/user-profile.controller";
import { UserProfileService } from "../user/services/user-profile.service";
import { UserFiltersService } from "../user/services/user-filters.service";
import { UserFollowingsService } from "../user/services/user-followings.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { UserLogsService } from "../user/services/user-logs.service";
import { UserLogs, UserLogsSchema } from "../user/schemas/user-logs.schema";
import { Game, GameDatabaseSchema } from "../games/schemas/game.schema";
import { JwtRefreshStrategy } from "./jwt-refresh.strategy";
import { FileService } from "../user/services/file-upload.service";
import { MetricsModule } from "../metrics/metrics.module";
import { IndexNowModule } from "../indexnow/indexnow.module";
import { MailModule } from "../mail/mail.module";
import { TwoFactorService } from "./two-factor.service";

@Module({
  imports: [
    ActivityModule,
    ConfigModule,
    MailModule,
    MongooseModule.forFeature([
      { name: "User", schema: UserSchema },
      { name: UserLogs.name, schema: UserLogsSchema },
      { name: Game.name, schema: GameDatabaseSchema },
    ]),

    MetricsModule,
    IndexNowModule,
    NotificationsModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        return {
          secret: config.get<string>("JWT_SECRET"),
          signOptions: {
            expiresIn: config.get("JWT_EXPIRE") as
              number | `${number}${"s" | "m" | "h" | "d"}`,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, UserProfileController],
  providers: [
    AuthService,
    TwoFactorService,
    UserProfileService,
    UserLogsService,
    UserFiltersService,
    UserFollowingsService,
    JwtStrategy,
    JwtRefreshStrategy,
    FileService,
  ],
  exports: [JwtStrategy, JwtRefreshStrategy, PassportModule],
})
export class AuthModule {}
