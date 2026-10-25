import { Module } from "@nestjs/common";

import { ScheduleModule } from "@nestjs/schedule";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./module/auth/auth.module";
import { GameAuthModule } from "./module/game-auth/game-auth.module";
import { UserModule } from "./module/user/user.module";
import { IgdbModule } from "./module/igdb/igdb.module";
import { ImagesModule } from "./module/images/images.module";
import { ArticlesModule } from "./module/articles/articles.module";
import { SitesModule } from "./module/sites/sites.module";
import { ProjectsModule } from "./module/projects/projects.module";
import { ServeStaticModule } from "@nestjs/serve-static";
import { RetroachievementsModule } from "./module/retroach/retroach.module";
import { SteamModule } from "./module/steam/steam.module";
import { GamesModule } from "./module/games/games.module";
import { CommentsModule } from "./module/comments/comments.module";
import { CollectionsModule } from "./module/collections/collections.module";
import { NotificationsModule } from "./module/notifications/notifications.module";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { THROTTLER_OPTIONS } from "./shared/throttle";
import { ErrorResponseFilter } from "./shared/error-response.filter";
import { ZodValidationPipe } from "nestjs-zod";
import { AdminModule } from "./module/admin/admin.module";
import { FaroModule } from "./module/faro/faro.module";
import { LoggerModule } from "nestjs-pino";
import { pinoConfig } from "./module/logger/logger.module";
import { MetricsModule } from "./module/metrics/metrics.module";
import { HttpMetricsInterceptor } from "./module/metrics/http-metrics.interceptor";
import { HttpModule } from "@nestjs/axios";
import { CacheModule } from "@nestjs/cache-manager";

@Module({
  imports: [
    ConfigModule.forRoot(),
    LoggerModule.forRootAsync(pinoConfig),
    MetricsModule,
    ThrottlerModule.forRoot(THROTTLER_OPTIONS),
    ...(process.env.DISABLE_CRONS === "true" ? [] : [ScheduleModule.forRoot()]),
    MongooseModule.forRoot(process.env.MONGO_CONNECTION_STRING, {
      dbName: "games",
      monitorCommands: true,
    }),
    HttpModule,
    CacheModule.register({ isGlobal: true }),
    AuthModule,
    GameAuthModule,
    UserModule,
    AdminModule,
    FaroModule,
    GamesModule,
    CommentsModule,
    CollectionsModule,
    NotificationsModule,
    IgdbModule,
    ImagesModule,
    ArticlesModule,
    SitesModule,
    RetroachievementsModule,
    SteamModule,
    ProjectsModule,
    ServeStaticModule.forRoot({
      rootPath: `/var/www/uploads/photos`,
      serveRoot: "/photos",
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: ErrorResponseFilter,
    },
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
})
export class AppModule {}
