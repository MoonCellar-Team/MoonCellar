import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import * as bcrypt from "bcryptjs";
import { type Query as ExpressQuery } from "express-serve-static-core";
import mongoose, { Model } from "mongoose";
import { User } from "../schemas/user.schema";
import {
  DEFAULT_BG_OPACITY,
  type IGetUserByStringRequest,
  type IGetUserLoginsResponse,
  type IUpdateUserDescriptionRequest,
  type IUpdateUserEmailRequest,
  type IUpdateUserPasswordRequest,
  type IUpdateUserSettingsRequest,
} from "@mooncellar/schemas";
import { FileService } from "./file-upload.service";
import { S3_FOLDERS } from "../../../shared/s3";

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private fileService: FileService
  ) {}

  async findById(userId: string): Promise<User> {
    try {
      return await this.userModel
        .findById(userId)
        .select([
          "-password",
          "-logs",
          "-createdAt",
          "-updatedAt",
          "-refreshToken",
          "-royalGames",
          "-oauth",
          "-__v",
        ]);
    } catch (err) {
      this.logger.error(err, `Failed to find user by id: ${userId}`);
      throw err;
    }
  }
  async findByString({ searchString }: IGetUserByStringRequest): Promise<User> {
    try {
      return await this.userModel
        .findOne({
          $or: [{ userName: searchString }, { email: searchString }],
        })
        .select([
          "-password",
          "-createdAt",
          "-refreshToken",
          "-royalGames",
          "-__v",
        ]);
    } catch (err) {
      this.logger.error(err, `Failed to find user by string: ${searchString}`);
      throw err;
    }
  }

  async findAllLogins(): Promise<IGetUserLoginsResponse> {
    try {
      const users = await this.userModel
        .find()
        .select("userName updatedAt")
        .exec();
      return users.map((user) => ({
        userName: user.userName,
        updatedAt: user.updatedAt.toISOString(),
      }));
    } catch (err) {
      this.logger.error(err, "Failed to find all user logins");
      throw err;
    }
  }

  async findAll(query: ExpressQuery): Promise<User[]> {
    try {
      const resPerPage = 2;
      const currentPage = +query.page || 1;
      const skip = resPerPage * (currentPage - 1);

      const keyword = query.keyword
        ? {
            title: {
              $regex: query.keyword,
              $options: "i",
            },
          }
        : {};
      const users = await this.userModel
        .find({ ...keyword })
        .limit(resPerPage)
        .skip(skip);
      return users;
    } catch (err) {
      this.logger.error(err, `Failed to find all users`);
      throw err;
    }
  }

  async updateEmail(
    userId: string,
    { email }: IUpdateUserEmailRequest
  ): Promise<User> {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) throw new NotFoundException("User not found");

      user.email = email;
      await user.save();
      return user;
    } catch (err) {
      this.logger.error(err, `Failed to update email: ${userId}`);
      throw err;
    }
  }

  async updatePassword(
    userId: string,
    { oldPassword, newPassword }: IUpdateUserPasswordRequest
  ): Promise<User> {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) throw new NotFoundException("User not found");

      const isPasswordMatched = await bcrypt.compare(
        oldPassword,
        user.password
      );
      if (!isPasswordMatched)
        throw new UnauthorizedException("Password does not match");

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();
      return user;
    } catch (err) {
      this.logger.error(err, `Failed to update password: ${userId}`);
      throw err;
    }
  }

  async updateAvatar(userId: string, file: Express.Multer.File): Promise<User> {
    try {
      const user = await this.userModel.findById(userId);
      const avatarId = new mongoose.Types.ObjectId().toString();

      if (!user) throw new NotFoundException("User not found");

      const storedKey = await this.fileService.uploadFile(
        file,
        avatarId,
        S3_FOLDERS.avatars
      );

      user.avatar = this.fileService.getPublicUrl(
        S3_FOLDERS.avatars,
        storedKey ?? avatarId
      );

      return user.save();
    } catch (err) {
      this.logger.error(err, `Failed to update avatar: ${userId}`);
      throw err;
    }
  }

  async updateBackground(
    userId: string,
    file: Express.Multer.File
  ): Promise<User> {
    try {
      const user = await this.userModel.findById(userId);
      const backgroundId = new mongoose.Types.ObjectId().toString();

      if (!user) throw new NotFoundException("User not found");

      const storedKey = await this.fileService.uploadFile(
        file,
        backgroundId,
        S3_FOLDERS.backgrounds
      );

      user.background = this.fileService.getPublicUrl(
        S3_FOLDERS.backgrounds,
        storedKey ?? backgroundId
      );

      return user.save();
    } catch (err) {
      this.logger.error(err, `Failed to update background for user: ${userId}`);
      throw err;
    }
  }

  async updateUserDescription(
    userId: string,
    { description }: IUpdateUserDescriptionRequest
  ) {
    try {
      const user = await this.userModel.findById(userId);

      user.description = description;
      await user.save();
      return user;
    } catch (err) {
      this.logger.error(err, `Failed to update user description: ${userId}`);
      throw err;
    }
  }

  async updateSettings(userId: string, settings: IUpdateUserSettingsRequest) {
    try {
      const user = await this.userModel.findById(userId);

      user.settings = {
        showAdultContent: false,
        bgOpacity: DEFAULT_BG_OPACITY,
        mutedNotifications: [],
        raSyncPlaythroughs: false,
        steamSyncPlaythroughs: false,
        hiddenProfileBlocks: [],
        ...(user.settings ?? {}),
        ...(settings.showAdultContent !== undefined && {
          showAdultContent: settings.showAdultContent,
        }),
        ...(settings.bgOpacity !== undefined && {
          bgOpacity: settings.bgOpacity,
        }),
        ...(settings.mutedNotifications !== undefined && {
          mutedNotifications: [...new Set(settings.mutedNotifications)],
        }),
        ...(settings.raSyncPlaythroughs !== undefined && {
          raSyncPlaythroughs: settings.raSyncPlaythroughs,
        }),
        ...(settings.steamSyncPlaythroughs !== undefined && {
          steamSyncPlaythroughs: settings.steamSyncPlaythroughs,
        }),
        ...(settings.hiddenProfileBlocks !== undefined && {
          hiddenProfileBlocks: [...new Set(settings.hiddenProfileBlocks)],
        }),
      };

      user.markModified("settings");
      await user.save();
      return user;
    } catch (err) {
      this.logger.error(err, `Failed to update user settings: ${userId}`);
      throw err;
    }
  }

  async updateUserTime(userId: string) {
    try {
      const user = await this.userModel.findById(userId);
      const now = new Date();
      const isoString = now.toISOString();
      const formattedDate = isoString.replace("Z", "+00:00");

      user.updatedAt = new Date(formattedDate);
      await user.save();
      return user;
    } catch (err) {
      this.logger.error(err, `Failed to update user time: ${userId}`);
      throw err;
    }
  }
}
