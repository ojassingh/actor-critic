import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "../_generated/server";

export const generateUploadUrl = action({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const label = "[chat/files: generateUploadUrl]";
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.error(`${label} unauthorized`);
      throw new ConvexError({ code: "AUTH_UNAUTHORIZED" });
    }
    const url = await ctx.storage.generateUploadUrl();
    console.info(`${label} issued upload url`);
    return url;
  },
});

export const getFilesForChat = query({
  args: { chatFileIds: v.array(v.id("chatFiles")) },
  returns: v.array(
    v.object({
      _id: v.id("chatFiles"),
      filename: v.string(),
      contentType: v.string(),
      url: v.string(),
      markdown: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "AUTH_UNAUTHORIZED" });
    }

    const results: Array<{
      _id: Id<"chatFiles">;
      filename: string;
      contentType: string;
      url: string;
      markdown?: string;
    }> = [];

    for (const chatFileId of args.chatFileIds) {
      const file = await ctx.db.get(chatFileId);
      if (!file || file.userId !== identity.subject) {
        throw new ConvexError({ code: "FORBIDDEN" });
      }
      const url = await ctx.storage.getUrl(file.storageId);
      if (!url) {
        throw new ConvexError({ code: "FILE_NOT_FOUND" });
      }
      results.push({
        _id: file._id,
        filename: file.filename,
        contentType: file.contentType,
        url,
        markdown: file.markdown,
      });
    }
    return results;
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

export const insertChatFile = internalMutation({
  args: {
    userId: v.string(),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
    storageId: v.id("_storage"),
    fileId: v.optional(v.string()),
    markdown: v.optional(v.string()),
    filePart: v.optional(v.any()),
    imagePart: v.optional(v.any()),
    expiresAt: v.number(),
  },
  returns: v.id("chatFiles"),
  handler: async (ctx, args) => {
    const chatFileId = await ctx.db.insert("chatFiles", args);
    return chatFileId;
  },
});
