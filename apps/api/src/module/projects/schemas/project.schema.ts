import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { type HydratedDocument } from "mongoose";
import type { IProjectBlock } from "@mooncellar/schemas";

export type ProjectDocument = HydratedDocument<Project>;

@Schema({ _id: false })
export class ProjectUpload {
  @Prop({ type: String, required: true })
  block: IProjectBlock;
  @Prop({ type: Date, required: true })
  updatedAt: Date;
  @Prop({ type: Number, required: true })
  size: number;
  @Prop({ type: Number, required: true })
  done: number;
  @Prop({ type: Number, required: true })
  total: number;
}

export const ProjectUploadSchema = SchemaFactory.createForClass(ProjectUpload);

@Schema({ _id: false })
export class ProjectToken {
  @Prop({ type: String, required: true })
  id: string;
  @Prop({ type: String, required: true })
  name: string;
  @Prop({ type: String, required: true })
  hash: string;
  @Prop({ type: Date, required: true })
  createdAt: Date;
  @Prop({ type: Date, default: null })
  lastUsedAt: Date | null;
}

export const ProjectTokenSchema = SchemaFactory.createForClass(ProjectToken);

@Schema({ collection: "projects", timestamps: true })
export class Project {
  @Prop({ type: String, required: true, unique: true })
  slug: string;
  @Prop({ type: String, required: true })
  name: string;
  @Prop({ type: [String], required: true })
  blocks: IProjectBlock[];
  @Prop({ type: String, enum: ["decomp", "plan"] })
  defaultBlock?: IProjectBlock;
  @Prop({ type: [ProjectTokenSchema], default: [] })
  tokens: ProjectToken[];
  @Prop({ type: String, select: false })
  tokenHash?: string;
  @Prop({ type: [ProjectUploadSchema], default: [] })
  uploads: ProjectUpload[];
  createdAt: Date;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
