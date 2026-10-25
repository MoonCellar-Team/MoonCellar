import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type {
  IGameAccount,
  IGameStorageFile,
  IGameStorageList,
  IGameStorageWriteResult,
} from "@mooncellar/schemas";
import { createHash } from "node:crypto";
import type { Model } from "mongoose";
import type { IGameDefinition } from "../../games/game-definition";
import { StorageBucket } from "./schemas/storage-bucket.schema";
import { StorageFile } from "./schemas/storage-file.schema";
import { folderOf, quotaProblem } from "./storage-quota";

type IFileRow = Pick<StorageFile, "path" | "size" | "sha256" | "updatedAt">;

@Injectable()
export class StorageService {
  constructor(
    @InjectModel(StorageFile.name) private readonly files: Model<StorageFile>,
    @InjectModel(StorageBucket.name)
    private readonly buckets: Model<StorageBucket>
  ) {}

  private limitsOf(game: IGameDefinition, bucket: string) {
    const limits = game.storage?.[bucket];
    if (!limits) {
      throw new NotFoundException(`${game.name} has no storage "${bucket}"`);
    }
    return limits;
  }

  private toFile(row: IFileRow): IGameStorageFile {
    return {
      path: row.path,
      size: row.size,
      sha256: row.sha256,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private key(game: IGameDefinition, bucket: string, account: IGameAccount) {
    return { game: game.slug, bucket, userId: account.id };
  }

  private async usage(
    game: IGameDefinition,
    bucket: string,
    account: IGameAccount
  ) {
    const [row] = await this.files.aggregate<{ files: number; bytes: number }>([
      { $match: this.key(game, bucket, account) },
      { $group: { _id: null, files: { $sum: 1 }, bytes: { $sum: "$size" } } },
    ]);
    return { files: row?.files ?? 0, bytes: row?.bytes ?? 0 };
  }

  private async folders(
    game: IGameDefinition,
    bucket: string,
    account: IGameAccount
  ) {
    const paths: string[] = await this.files
      .distinct("path", this.key(game, bucket, account))
      .exec();
    const folders = new Set<string>();
    for (const path of paths) {
      const folder = folderOf(path);
      if (folder !== null) folders.add(folder);
    }
    return [...folders];
  }

  private async expectRevision(
    game: IGameDefinition,
    bucket: string,
    account: IGameAccount,
    revision: number | undefined
  ) {
    if (revision === undefined) return;
    const state = await this.buckets
      .findOne(this.key(game, bucket, account))
      .lean();
    const current = state?.revision ?? 0;
    if (current !== revision) {
      throw new ConflictException(
        `The storage changed since revision ${revision} (now ${current}). Fetch it again`
      );
    }
  }

  private async bump(
    game: IGameDefinition,
    bucket: string,
    account: IGameAccount
  ) {
    const usage = await this.usage(game, bucket, account);
    const state = await this.buckets.findOneAndUpdate(
      this.key(game, bucket, account),
      { $inc: { revision: 1 }, $set: { usedBytes: usage.bytes } },
      { upsert: true, new: true }
    );
    return { revision: state.revision, usedBytes: state.usedBytes };
  }

  async list(
    game: IGameDefinition,
    bucket: string,
    account: IGameAccount
  ): Promise<IGameStorageList> {
    const limits = this.limitsOf(game, bucket);
    const key = this.key(game, bucket, account);
    const [state, rows] = await Promise.all([
      this.buckets.findOne(key).lean(),
      this.files.find(key).sort({ path: 1 }).lean(),
    ]);
    return {
      game: game.slug,
      bucket,
      revision: state?.revision ?? 0,
      createdAt: state?.createdAt?.toISOString() ?? null,
      usedBytes: state?.usedBytes ?? 0,
      maxBytes: limits.maxBytes,
      maxFileBytes: limits.maxFileBytes,
      maxFiles: limits.maxFiles,
      files: rows.map((row) => this.toFile(row)),
    };
  }

  async read(
    game: IGameDefinition,
    bucket: string,
    account: IGameAccount,
    path: string
  ): Promise<{ data: Buffer; file: IGameStorageFile }> {
    this.limitsOf(game, bucket);
    const row = await this.files
      .findOne({ ...this.key(game, bucket, account), path })
      .select("+data");
    if (!row)
      throw new NotFoundException("There is no such file in the storage");
    return { data: Buffer.from(row.data), file: this.toFile(row) };
  }

  async write(
    game: IGameDefinition,
    bucket: string,
    account: IGameAccount,
    path: string,
    data: Buffer,
    revision?: number
  ): Promise<IGameStorageWriteResult> {
    const limits = this.limitsOf(game, bucket);
    await this.expectRevision(game, bucket, account, revision);
    const key = { ...this.key(game, bucket, account), path };
    const [existing, usage, folders] = await Promise.all([
      this.files.findOne(key).select("size").lean(),
      this.usage(game, bucket, account),
      limits.maxFolders === undefined
        ? Promise.resolve(undefined)
        : this.folders(game, bucket, account),
    ]);
    const problem = quotaProblem(
      limits,
      { ...usage, folders },
      existing?.size ?? null,
      data.length,
      path
    );
    if (problem) throw new UnprocessableEntityException(problem);
    const sha256 = createHash("sha256").update(data).digest("hex");
    const row = await this.files.findOneAndUpdate(
      key,
      { $set: { data, size: data.length, sha256 } },
      { upsert: true, new: true }
    );
    return {
      ...(await this.bump(game, bucket, account)),
      file: this.toFile(row),
    };
  }

  async remove(
    game: IGameDefinition,
    bucket: string,
    account: IGameAccount,
    path: string,
    revision?: number
  ): Promise<IGameStorageWriteResult> {
    this.limitsOf(game, bucket);
    await this.expectRevision(game, bucket, account, revision);
    const result = await this.files.deleteOne({
      ...this.key(game, bucket, account),
      path,
    });
    if (result.deletedCount === 0) {
      throw new NotFoundException("There is no such file in the storage");
    }
    return { ...(await this.bump(game, bucket, account)), file: null };
  }
}
