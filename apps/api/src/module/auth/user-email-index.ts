import type { Model } from "mongoose";
import type { User } from "../user/schemas/user.schema";

export const EMAIL_INDEX_NAME = "email_1";

const partialEmailIndex = {
  unique: true,
  name: EMAIL_INDEX_NAME,
  partialFilterExpression: { email: { $exists: true } },
};

export const ensurePartialEmailIndex = async (
  users: Model<User>
): Promise<"created" | "unchanged"> => {
  const collection = users.collection;

  let hasPartial = false;
  let hasLegacy = false;

  try {
    const indexes = await collection.indexes();
    const emailIndex = indexes.find(
      (index) => index.name === EMAIL_INDEX_NAME
    );

    hasPartial = !!emailIndex?.partialFilterExpression;
    hasLegacy = !!emailIndex && !hasPartial;
  } catch {
    hasPartial = false;
    hasLegacy = false;
  }

  if (hasPartial) return "unchanged";

  if (hasLegacy) {
    await collection.dropIndex(EMAIL_INDEX_NAME);
  }

  await collection.createIndex({ email: 1 }, partialEmailIndex);

  return "created";
};
