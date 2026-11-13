import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { MaxLength } from "class-validator";
import mongoose, { Document } from "mongoose";
import {
  type IRAAward,
  type IRaPending,
  type ISteamProgress,
  type IRole,
  DEFAULT_BG_OPACITY,
  type IUserSettings,
} from "@mooncellar/schemas";

@Schema({ _id: false })
export class UserSteamAccount {
  @Prop({ type: String, required: true })
  steamId: string;
  @Prop({ type: Date, required: true })
  linkedAt: Date;
  @Prop({ type: Date, default: null })
  syncedAt: Date | null;
  @Prop({ type: [Object], default: undefined })
  achievements?: ISteamProgress[];
  @Prop({ type: Date, default: null })
  achievementsSyncedAt?: Date | null;
  @Prop({ type: Number })
  libraryCount?: number;
}

export const UserSteamAccountSchema =
  SchemaFactory.createForClass(UserSteamAccount);

@Schema({ _id: false })
export class UserEmailCode {
  @Prop({ type: String, default: null })
  codeHash: string | null;
  @Prop({ type: Date, default: null })
  expiresAt: Date | null;
  @Prop({ type: Number, default: 0 })
  attempts: number;
  @Prop({ type: Date, default: null })
  resendAt: Date | null;
}

export const UserEmailCodeSchema = SchemaFactory.createForClass(UserEmailCode);

@Schema({ _id: false })
export class UserTwoFactor {
  @Prop({ type: String, enum: ["off", "email", "app"], default: "off" })
  method: string;
  @Prop({ type: String, enum: ["email", "app"], default: null })
  pendingMethod: string | null;
  @Prop({ type: String, default: null })
  totpSecretEncrypted: string | null;
  @Prop({ type: [String], default: [] })
  backupCodes: string[];
  @Prop({ type: Date, default: null })
  backupCodesGeneratedAt: Date | null;
}

export const UserTwoFactorSchema = SchemaFactory.createForClass(UserTwoFactor);

@Schema({ _id: false })
export class UserOAuthAccount {
  @Prop({ type: String, required: true })
  providerId: string;
  @Prop({ type: String, default: null })
  providerUserName: string | null;
  @Prop({ type: Date, required: true })
  linkedAt: Date;
}

export const UserOAuthAccountSchema =
  SchemaFactory.createForClass(UserOAuthAccount);

@Schema({ _id: false })
export class UserOAuthLinks {
  @Prop({ type: UserOAuthAccountSchema, default: null })
  google?: UserOAuthAccount | null;
  @Prop({ type: UserOAuthAccountSchema, default: null })
  github?: UserOAuthAccount | null;
  @Prop({ type: UserOAuthAccountSchema, default: null })
  reddit?: UserOAuthAccount | null;
}

export const UserOAuthLinksSchema =
  SchemaFactory.createForClass(UserOAuthLinks);

@Schema({
  timestamps: true,
})
export class User extends Document {
  @Prop({ unique: true, required: true })
  userName: string;
  @Prop()
  email: string;
  @Prop()
  password: string;
  @Prop()
  refreshToken?: string;
  @Prop({ type: Boolean, default: true })
  emailVerified: boolean;
  @Prop({ type: UserEmailCodeSchema, default: null })
  verificationCode?: UserEmailCode | null;
  @Prop({ type: UserEmailCodeSchema, default: null })
  twoFactorCode?: UserEmailCode | null;
  @Prop({ type: UserTwoFactorSchema, default: null })
  twoFactor?: UserTwoFactor | null;
  @Prop({ type: [{ type: mongoose.Types.ObjectId, ref: "User" }], default: [] })
  followings: mongoose.Types.ObjectId[];
  @Prop({ type: [{ type: mongoose.Types.ObjectId, ref: "User" }], default: [] })
  followers: mongoose.Types.ObjectId[];
  @Prop({ type: [Object] })
  filters: { name: string; filter: string }[];
  @Prop({ type: [Object] })
  presets: { name: string; preset: string }[];
  @Prop()
  @MaxLength(450)
  description?: string;
  @Prop()
  raUsername?: string;
  @Prop()
  raUlid?: string;
  @Prop()
  raUserPic?: string;
  @Prop()
  raVerifiedAt?: string;
  @Prop()
  raSyncedAt?: string;
  @Prop({ type: Object, default: null })
  raPending?: IRaPending | null;
  @Prop({ type: [Object] })
  raAwards: IRAAward[];
  @Prop({ type: [Number], default: [] })
  raIgnoredSets: number[];
  @Prop({ type: [Number], default: [] })
  steamIgnoredApps: number[];
  @Prop({ type: UserSteamAccountSchema, required: false })
  steam?: UserSteamAccount;
  @Prop({ type: UserOAuthLinksSchema })
  oauth?: UserOAuthLinks;
  @Prop({ type: [String], default: ["user"] })
  roles: IRole[];
  @Prop()
  avatar: string;
  @Prop()
  background: string;
  @Prop({
    type: Object,
    default: {
      showAdultContent: false,
      bgOpacity: DEFAULT_BG_OPACITY,
      mutedNotifications: [],
      raSyncPlaythroughs: false,
      steamSyncPlaythroughs: false,
      hiddenProfileBlocks: [],
    },
  })
  settings: IUserSettings;
  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Game" }],
    default: [],
  })
  royalGames: mongoose.Types.ObjectId[];
  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Game" }],
    default: [],
  })
  favorites: mongoose.Types.ObjectId[];
  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Character" }],
    default: [],
  })
  favoriteCharacters: mongoose.Types.ObjectId[];
  @Prop()
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index(
  { "steam.steamId": 1 },
  {
    unique: true,
    partialFilterExpression: { "steam.steamId": { $exists: true } },
  }
);

const OAUTH_LINK_INDEXES = [
  "oauth.google.providerId",
  "oauth.github.providerId",
  "oauth.reddit.providerId",
] as const;

OAUTH_LINK_INDEXES.forEach((providerIdPath) =>
  UserSchema.index(
    { [providerIdPath]: 1 },
    {
      unique: true,
      partialFilterExpression: { [providerIdPath]: { $exists: true } },
      name: providerIdPath.replace(/\./g, "_"),
    }
  )
);

const stripAuthSecrets = (_doc: unknown, ret: any): any => {
  delete ret.verificationCode;
  delete ret.twoFactorCode;
  delete ret.twoFactor;
  return ret;
};

UserSchema.set("toJSON", { transform: stripAuthSecrets });
UserSchema.set("toObject", { transform: stripAuthSecrets });
