import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";

export const generateUploadUrl = action({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const label = "[storage: generateUploadUrl]";
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.error(`${label} unauthorized`);
      throw new ConvexError({ code: "AUTH_UNAUTHORIZED" });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const getStorageMetadata = internalQuery({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.object({
    contentType: v.optional(v.string()),
    size: v.number(),
  }),
  handler: async (ctx, args) => {
    const metadata = await ctx.db.system.get("_storage", args.storageId);
    if (!metadata) {
      throw new ConvexError({ code: "FILE_NOT_FOUND" });
    }
    return {
      contentType: metadata.contentType,
      size: metadata.size,
    };
  },
});

export const deleteStorageFile = internalMutation({
  args: { storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.storageId);
    return null;
  },
});
