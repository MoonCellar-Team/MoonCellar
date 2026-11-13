import type { Model } from "mongoose";
import type { User } from "../user/schemas/user.schema";
import { EMAIL_INDEX_NAME, ensurePartialEmailIndex } from "./user-email-index";

const modelWith = (indexes: unknown[]) => {
  const collection = {
    indexes: jest.fn().mockResolvedValue(indexes),
    dropIndex: jest.fn().mockResolvedValue(undefined),
    createIndex: jest.fn().mockResolvedValue(undefined),
  };

  return { model: { collection } as unknown as Model<User>, collection };
};

describe("ensurePartialEmailIndex", () => {
  it("drops the older unique index and creates a partial one", async () => {
    const { model, collection } = modelWith([
      { name: EMAIL_INDEX_NAME, unique: true, key: { email: 1 } },
    ]);

    await expect(ensurePartialEmailIndex(model)).resolves.toBe("created");

    expect(collection.dropIndex).toHaveBeenCalledWith(EMAIL_INDEX_NAME);
    expect(collection.createIndex).toHaveBeenCalledWith(
      { email: 1 },
      expect.objectContaining({
        name: EMAIL_INDEX_NAME,
        unique: true,
        partialFilterExpression: { email: { $exists: true } },
      })
    );
  });

  it("leaves an index that is already partial alone", async () => {
    const { model, collection } = modelWith([
      {
        name: EMAIL_INDEX_NAME,
        unique: true,
        key: { email: 1 },
        partialFilterExpression: { email: { $exists: true } },
      },
    ]);

    await expect(ensurePartialEmailIndex(model)).resolves.toBe("unchanged");

    expect(collection.dropIndex).not.toHaveBeenCalled();
    expect(collection.createIndex).not.toHaveBeenCalled();
  });

  it("creates the index on a collection that has none", async () => {
    const { model, collection } = modelWith([]);

    await expect(ensurePartialEmailIndex(model)).resolves.toBe("created");

    expect(collection.dropIndex).not.toHaveBeenCalled();
    expect(collection.createIndex).toHaveBeenCalledTimes(1);
  });

  it("creates the index when the collection does not exist yet", async () => {
    const { model, collection } = modelWith([]);
    collection.indexes.mockRejectedValue(new Error("ns does not exist"));

    await expect(ensurePartialEmailIndex(model)).resolves.toBe("created");

    expect(collection.createIndex).toHaveBeenCalledTimes(1);
  });
});
