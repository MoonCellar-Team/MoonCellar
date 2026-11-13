import {
  IRaPending,
  IRole,
  ISteamAccount,
  IUserSettings,
} from "@mooncellar/schemas";
import { IRAAward } from "./retroachievements.type";
import { IFollowers, IFollowings, IUserFilter, IUserPreset } from "./user.type";

export interface IAuth {
  userName: string;
  email: string;
  password: string;
}

export interface IUser {
  _id: string;
  userName: string;
  email?: string;
  followings: IFollowings;
  followers: IFollowers;
  favorites?: string[];
  favoriteCharacters?: string[];
  filters: IUserFilter[];
  presets: IUserPreset[];
  updatedAt: Date;
  createdAt: Date;
  description: string;
  raUsername?: string;
  raUlid?: string | null;
  raUserPic?: string | null;
  raVerifiedAt?: string | null;
  raSyncedAt?: string | null;
  raPending?: IRaPending | null;
  raAwards?: IRAAward[];
  roles?: string[];
  avatar: string;
  background?: string;
  settings?: Partial<IUserSettings>;
  steam?: ISteamAccount | null;
}

export interface IAuthToken {
  id: string;
  username: string;
  roles: IRole[];
  email: string;
  iat: number;
  exp: number;
}
