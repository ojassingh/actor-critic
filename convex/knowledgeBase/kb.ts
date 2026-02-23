import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
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
    const results = await Promise.all(
      files.map(async (file) => {
        const url = await ctx.storage.getUrl(file.storageId);
        if (!url) {
          return null;
        }
        return {
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
        };
      })
    );
    return results.filter((file) => file !== null);
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

export const searchKnowledgeBaseInternal = internalQuery({
  args: {
    userId: v.string(),
    chunkIds: v.array(v.id("knowledgeBaseChunks")),
  },
  returns: v.array(
    v.object({
      fileId: v.id("knowledgeBaseFiles"),
      filename: v.string(),
      content: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const fileNames = new Map<Id<"knowledgeBaseFiles">, string>();
    const matches: Array<{
      fileId: Id<"knowledgeBaseFiles">;
      filename: string;
      content: string;
    }> = [];

    for (const chunkId of args.chunkIds) {
      const chunk = await ctx.db.get(chunkId);
      if (!chunk || chunk.userId !== args.userId) {
        continue;
      }
      if (!fileNames.has(chunk.fileId)) {
        const file = await ctx.db.get(chunk.fileId);
        if (!file || file.userId !== args.userId) {
          continue;
        }
        fileNames.set(chunk.fileId, file.filename);
      }
      const filename = fileNames.get(chunk.fileId);
      if (!filename) {
        continue;
      }
      matches.push({
        fileId: chunk.fileId,
        filename,
        content: chunk.content,
      });
    }

    return matches;
  },
});
