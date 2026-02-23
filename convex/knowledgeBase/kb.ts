import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, query } from "../_generated/server";

export const listFiles = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("knowledgeBaseFiles"),
      _creationTime: v.number(),
      filename: v.string(),
      contentType: v.string(),
      url: v.string(),
      size: v.number(),
      status: v.union(
        v.literal("processing"),
        v.literal("ready"),
        v.literal("failed")
      ),
      errorMessage: v.optional(v.string()),
      chunkCount: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? null;
    if (!userId) {
      return [];
    }
    const files = await ctx.db
      .query("knowledgeBaseFiles")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    const results: Array<{
      _id: (typeof files)[number]["_id"];
      _creationTime: number;
      filename: string;
      contentType: string;
      url: string;
      size: number;
      status: "processing" | "ready" | "failed";
      errorMessage?: string;
      chunkCount?: number;
      createdAt: number;
      updatedAt: number;
    }> = [];

    for (const file of files) {
      const url = await ctx.storage.getUrl(file.storageId);
      if (!url) {
        throw new ConvexError({ code: "FILE_NOT_FOUND" });
      }
      results.push({
        _id: file._id,
        _creationTime: file._creationTime,
        filename: file.filename,
        contentType: file.contentType,
        url,
        size: file.size,
        status: file.status,
        errorMessage: file.errorMessage,
        chunkCount: file.chunkCount,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      });
    }

    return results;
  },
});

export const getFileInternal = internalQuery({
  args: { fileId: v.id("knowledgeBaseFiles") },
  returns: v.union(
    v.object({
      _id: v.id("knowledgeBaseFiles"),
      _creationTime: v.number(),
      userId: v.string(),
      filename: v.string(),
      contentType: v.string(),
      size: v.number(),
      storageId: v.id("_storage"),
      status: v.union(
        v.literal("processing"),
        v.literal("ready"),
        v.literal("failed")
      ),
      errorMessage: v.optional(v.string()),
      chunkCount: v.optional(v.number()),
      taskId: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.fileId);
  },
});

export const insertFileInternal = internalMutation({
  args: {
    userId: v.string(),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
    storageId: v.id("_storage"),
  },
  returns: v.id("knowledgeBaseFiles"),
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    return await ctx.db.insert("knowledgeBaseFiles", {
      ...args,
      status: "processing",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  },
});

export const updateFileInternal = internalMutation({
  args: {
    fileId: v.id("knowledgeBaseFiles"),
    status: v.optional(
      v.union(v.literal("processing"), v.literal("ready"), v.literal("failed"))
    ),
    errorMessage: v.optional(v.string()),
    chunkCount: v.optional(v.number()),
    taskId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { fileId, ...patch } = args;
    await ctx.db.patch(fileId, { ...patch, updatedAt: Date.now() });
    return null;
  },
});

export const deleteFileInternal = internalMutation({
  args: {
    fileId: v.id("knowledgeBaseFiles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const chunks = await ctx.db
      .query("knowledgeBaseChunks")
      .withIndex("by_fileId", (q) => q.eq("fileId", args.fileId))
      .collect();
    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }
    await ctx.db.delete(args.fileId);
    return null;
  },
});

export const insertChunksInternal = internalMutation({
  args: {
    chunks: v.array(
      v.object({
        userId: v.string(),
        fileId: v.id("knowledgeBaseFiles"),
        chunkIndex: v.number(),
        content: v.string(),
        embed: v.string(),
        embedding: v.array(v.float64()),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const chunk of args.chunks) {
      await ctx.db.insert("knowledgeBaseChunks", chunk);
    }
    return null;
  },
});
