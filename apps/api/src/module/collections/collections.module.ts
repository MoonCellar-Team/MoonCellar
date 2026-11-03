import { Module } from "@nestjs/common";
import { ActivityModule } from "../activity/activity.module";
import { MongooseModule } from "@nestjs/mongoose";
import {
  Character,
  CharacterDatabaseSchema,
} from "../games/schemas/character.schema";
import { Game, GameDatabaseSchema } from "../games/schemas/game.schema";
import {
  Platform,
  PlatformDatabaseSchema,
} from "../games/schemas/platform.schema";
import {
  Playthrough,
  PlaythroughDatabaseSchema,
} from "../games/schemas/playthroughs.schema";
import { MetricsModule } from "../metrics/metrics.module";
import { UserLogs, UserLogsSchema } from "../user/schemas/user-logs.schema";
import { User, UserSchema } from "../user/schemas/user.schema";
import { UserLogsService } from "../user/services/user-logs.service";
import { CollectionsController } from "./controllers/collections.controller";
import { CustomListsController } from "./controllers/custom-lists.controller";
import { FavoritesController } from "./controllers/favorites.controller";
import { UsersSearchController } from "./controllers/users-search.controller";
import {
  CustomList,
  CustomListDatabaseSchema,
} from "./schemas/custom-list.schema";
import {
  CustomListLike,
  CustomListLikeDatabaseSchema,
} from "./schemas/custom-list-like.schema";
import { CustomListsService } from "./services/custom-lists.service";
import { FavoritesService } from "./services/favorites.service";
import { GeneratedListsService } from "./services/generated-lists.service";
import { UsersSearchService } from "./services/users-search.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    ActivityModule,
    MongooseModule.forFeature([
      { name: CustomList.name, schema: CustomListDatabaseSchema },
      { name: CustomListLike.name, schema: CustomListLikeDatabaseSchema },
      { name: User.name, schema: UserSchema },
      { name: Game.name, schema: GameDatabaseSchema },
      { name: Character.name, schema: CharacterDatabaseSchema },
      { name: Platform.name, schema: PlatformDatabaseSchema },
      { name: Playthrough.name, schema: PlaythroughDatabaseSchema },
      { name: UserLogs.name, schema: UserLogsSchema },
    ]),
    MetricsModule,
    NotificationsModule,
  ],
  controllers: [
    CustomListsController,
    CollectionsController,
    FavoritesController,
    UsersSearchController,
  ],
  providers: [
    CustomListsService,
    FavoritesService,
    GeneratedListsService,
    UsersSearchService,
    UserLogsService,
  ],
  exports: [CustomListsService],
})
export class CollectionsModule {}
