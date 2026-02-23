import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery, query } from "../_generated/server";

const fileStatusValidator = v.union(
  v.literal("processing"),
  v.literal("ready"),
  v.literal("failed")
);

const bboxValidator = v.object({
  left: v.number(),
  top: v.number(),
  width: v.number(),
  height: v.number(),
});

const storedFileValidator = v.object({
  _id: v.id("knowledgeBaseFiles"),
  _creationTime: v.number(),
  userId: v.string(),
  filename: v.string(),
  contentType: v.string(),
  size: v.number(),
  storageId: v.id("_storage"),
  status: fileStatusValidator,
  errorMessage: v.optional(v.string()),
  chunkCount: v.optional(v.number()),
  taskId: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const searchMatchValidator = v.object({
  fileId: v.id("knowledgeBaseFiles"),
  filename: v.string(),
  content: v.string(),
  chunkId: v.optional(v.string()),
  segmentId: v.optional(v.string()),
  pageNumber: v.optional(v.number()),
  pageWidth: v.optional(v.number()),
  pageHeight: v.optional(v.number()),
  bbox: v.optional(bboxValidator),
});

const isPresent = <T>(value: T | null): value is T => value !== null;

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
      status: fileStatusValidator,
      errorMessage: v.optional(v.string()),
      chunkCount: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const files = await ctx.db
      .query("knowledgeBaseFiles")
      .withIndex("by_userId_and_createdAt", (q) =>
        q.eq("userId", identity.subject)
      )
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

    return results.filter(isPresent);
  },
});

export const getFileInternal = internalQuery({
  args: { fileId: v.id("knowledgeBaseFiles") },
  returns: v.union(storedFileValidator, v.null()),
  handler: (ctx, args) => ctx.db.get(args.fileId),
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
  handler: (ctx, args) => {
    const timestamp = Date.now();
    return ctx.db.insert("knowledgeBaseFiles", {
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
    status: v.optional(fileStatusValidator),
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
        chunkId: v.optional(v.string()),
        segmentId: v.optional(v.string()),
        pageNumber: v.optional(v.number()),
        pageWidth: v.optional(v.number()),
        pageHeight: v.optional(v.number()),
        bbox: v.optional(bboxValidator),
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

export const hydrateChunkResults = internalQuery({
  args: {
    chunkIds: v.array(v.id("knowledgeBaseChunks")),
    userId: v.string(),
  },
  returns: v.array(searchMatchValidator),
  handler: async (ctx, args) => {
    const chunks = await Promise.all(args.chunkIds.map((id) => ctx.db.get(id)));

    const fileNameCache = new Map<Id<"knowledgeBaseFiles">, string | null>();

    const resolveFilename = async (
      fileId: Id<"knowledgeBaseFiles">
    ): Promise<string | null> => {
      const cached = fileNameCache.get(fileId);
      if (cached !== undefined) {
        return cached;
      }
      const file = await ctx.db.get(fileId);
      const name = file && file.userId === args.userId ? file.filename : null;
      fileNameCache.set(fileId, name);
      return name;
    };

    const matches = await Promise.all(
      chunks.map(async (chunk) => {
        if (!chunk || chunk.userId !== args.userId) {
          return null;
        }
        const filename = await resolveFilename(chunk.fileId);
        if (!filename) {
          return null;
        }
        return {
          fileId: chunk.fileId,
          filename,
          content: chunk.content,
          chunkId: chunk.chunkId,
          segmentId: chunk.segmentId,
          pageNumber: chunk.pageNumber,
          pageWidth: chunk.pageWidth,
          pageHeight: chunk.pageHeight,
          bbox: chunk.bbox,
        };
      })
    );

    return matches.filter(isPresent);
  },
});

export const getFileViewerInfo = query({
  args: {
    fileId: v.id("knowledgeBaseFiles"),
  },
  returns: v.union(
    v.object({
      contentType: v.string(),
      filename: v.string(),
      url: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const file = await ctx.db.get(args.fileId);
    if (!file || file.userId !== identity.subject) {
      return null;
    }
    const url = await ctx.storage.getUrl(file.storageId);
    if (!url) {
      return null;
    }
    return {
      contentType: file.contentType,
      filename: file.filename,
      url,
    };
  },
});
