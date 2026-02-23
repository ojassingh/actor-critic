"use node";

import { embed, embedMany } from "ai";
import Chunkr from "chunkr-ai";
import { ConvexError, v } from "convex/values";
import pRetry from "p-retry";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, action, internalAction } from "../_generated/server";
import { searchMatchValidator } from "./kb";

interface SearchMatch {
  bbox?: { left: number; top: number; width: number; height: number };
  chunkId?: string;
  content: string;
  fileId: Id<"knowledgeBaseFiles">;
  filename: string;
  pageHeight?: number;
  pageNumber?: number;
  pageWidth?: number;
  segmentId?: string;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const CHUNKR_POLL_DELAY_MS = 2000;
const CHUNKR_MAX_POLL_ATTEMPTS = 60;
const CHUNKR_TARGET_TOKENS = 6000;
const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const DEFAULT_SEARCH_LIMIT = 6;
const MAX_SEARCH_LIMIT = 20;

const isAllowedContentType = (contentType: string): boolean =>
  contentType === "application/pdf" || contentType.startsWith("image/");

const requireUserId = async (
  ctx: ActionCtx,
  label: string
): Promise<string> => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    console.error(`${label} unauthorized`);
    throw new ConvexError({ code: "AUTH_UNAUTHORIZED" });
  }
  return identity.subject;
};

const toSearchLimit = (value: number | undefined): number => {
  const normalized = Math.trunc(value ?? DEFAULT_SEARCH_LIMIT);
  return Math.min(Math.max(normalized, 1), MAX_SEARCH_LIMIT);
};

export const registerUpload = action({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
  },
  returns: v.object({
    fileId: v.id("knowledgeBaseFiles"),
  }),
  handler: async (ctx, args): Promise<{ fileId: Id<"knowledgeBaseFiles"> }> => {
    const label = "[knowledgeBase/kbActions: registerUpload]";
    const userId = await requireUserId(ctx, label);

    const metadata = await ctx.runQuery(internal.storage.getStorageMetadata, {
      storageId: args.storageId,
    });
    const contentType = metadata.contentType ?? "";
    if (!isAllowedContentType(contentType)) {
      await ctx.runMutation(internal.storage.deleteStorageFile, {
        storageId: args.storageId,
      });
      console.error(`${label} unsupported content type`);
      throw new ConvexError({ code: "UNSUPPORTED_CONTENT_TYPE" });
    }
    if (metadata.size > MAX_FILE_BYTES) {
      await ctx.runMutation(internal.storage.deleteStorageFile, {
        storageId: args.storageId,
      });
      console.error(`${label} file too large`);
      throw new ConvexError({ code: "FILE_TOO_LARGE" });
    }

    const fileId = await ctx.runMutation(
      internal.knowledgeBase.kb.insertFileInternal,
      {
        userId,
        filename: args.filename,
        contentType,
        size: metadata.size,
        storageId: args.storageId,
      }
    );

    await ctx.scheduler.runAfter(
      0,
      internal.knowledgeBase.kbActions.processFile,
      { fileId }
    );

    console.info(`${label} file registered`);
    return { fileId };
  },
});

export const processFile = internalAction({
  args: {
    fileId: v.id("knowledgeBaseFiles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const label = "[knowledgeBase/kbActions: processFile]";
    try {
      const file = await ctx.runQuery(
        internal.knowledgeBase.kb.getFileInternal,
        { fileId: args.fileId }
      );
      if (!file) {
        throw new ConvexError({ code: "FILE_NOT_FOUND" });
      }

      const url = await ctx.storage.getUrl(file.storageId);
      if (!url) {
        throw new ConvexError({ code: "FILE_NOT_FOUND" });
      }

      const apiKey = process.env.CHUNKR_API_KEY;
      if (!apiKey) {
        throw new ConvexError({
          code: "INTERNAL_ERROR",
          message: "CHUNKR_API_KEY is missing",
        });
      }

      const chunkProcessing: Chunkr.ChunkProcessing = {
        target_length: CHUNKR_TARGET_TOKENS,
        tokenizer: { Enum: "Cl100kBase" },
      };

      const client = new Chunkr({ apiKey });
      const task = await client.tasks.parse.create({
        file: url,
        chunk_processing: chunkProcessing,
      });
      await ctx.runMutation(internal.knowledgeBase.kb.updateFileInternal, {
        fileId: file._id,
        taskId: task.task_id,
      });

      const completed = await pRetry(
        async () => {
          const current = await client.tasks.parse.get(task.task_id);
          if (!current.completed) {
            throw new Error("Not yet completed");
          }
          return current;
        },
        {
          retries: CHUNKR_MAX_POLL_ATTEMPTS,
          minTimeout: CHUNKR_POLL_DELAY_MS,
          factor: 1,
        }
      );

      if (completed.status !== "Succeeded") {
        throw new ConvexError({
          code: "INTERNAL_ERROR",
          message: completed.message ?? "Chunkr task failed",
        });
      }

      const segments = (completed.output?.chunks ?? [])
        .flatMap((chunk, chunkIndex) =>
          (chunk.segments ?? []).map((segment) => {
            const content =
              segment.content ?? segment.text ?? segment.embed ?? "";
            const embedText =
              segment.embed ?? segment.content ?? segment.text ?? "";
            return {
              chunkIndex,
              chunkId: chunk.chunk_id ?? undefined,
              segmentId: segment.segment_id ?? undefined,
              pageNumber: segment.page_number,
              pageWidth: segment.page_width,
              pageHeight: segment.page_height,
              bbox: segment.bbox,
              content,
              embedText,
            };
          })
        )
        .filter((segment) => segment.embedText.trim().length > 0);

      if (segments.length === 0) {
        await ctx.runMutation(internal.knowledgeBase.kb.updateFileInternal, {
          fileId: file._id,
          status: "ready",
          chunkCount: 0,
        });
        return null;
      }

      const { embeddings } = await embedMany({
        model: EMBEDDING_MODEL,
        values: segments.map((segment) => segment.embedText),
      });

      const rows = segments.map((segment, index) => {
        const embedding = embeddings[index];
        if (!embedding) {
          throw new ConvexError({
            code: "INTERNAL_ERROR",
            message: "Missing embedding result",
          });
        }
        return {
          userId: file.userId,
          fileId: file._id,
          chunkIndex: segment.chunkIndex,
          chunkId: segment.chunkId,
          segmentId: segment.segmentId,
          pageNumber: segment.pageNumber,
          pageWidth: segment.pageWidth,
          pageHeight: segment.pageHeight,
          bbox: segment.bbox,
          content: segment.content,
          embed: segment.embedText,
          embedding,
        };
      });

      if (rows.length > 0) {
        await ctx.runMutation(internal.knowledgeBase.kb.insertChunksInternal, {
          chunks: rows,
        });
      }

      await ctx.runMutation(internal.knowledgeBase.kb.updateFileInternal, {
        fileId: file._id,
        status: "ready",
        chunkCount: rows.length,
      });

      console.info(`${label} completed`);
      return null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Something went wrong";
      await ctx.runMutation(internal.knowledgeBase.kb.updateFileInternal, {
        fileId: args.fileId,
        status: "failed",
        errorMessage,
      });
      console.error(`${label} failed`, error);
      return null;
    }
  },
});

export const retryProcessFile = action({
  args: {
    fileId: v.id("knowledgeBaseFiles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const label = "[knowledgeBase/kbActions: retryProcessFile]";
    const userId = await requireUserId(ctx, label);

    const file = await ctx.runQuery(internal.knowledgeBase.kb.getFileInternal, {
      fileId: args.fileId,
    });
    if (!file) {
      throw new ConvexError({ code: "FILE_NOT_FOUND" });
    }
    if (file.userId !== userId) {
      throw new ConvexError({ code: "FORBIDDEN" });
    }

    await ctx.runMutation(internal.knowledgeBase.kb.updateFileInternal, {
      fileId: args.fileId,
      status: "processing",
      errorMessage: undefined,
      chunkCount: undefined,
      taskId: undefined,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.knowledgeBase.kbActions.processFile,
      { fileId: args.fileId }
    );

    console.info(`${label} retry scheduled`);
    return null;
  },
});

export const deleteFile = action({
  args: {
    fileId: v.id("knowledgeBaseFiles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const label = "[knowledgeBase/kbActions: deleteFile]";
    const userId = await requireUserId(ctx, label);

    const file = await ctx.runQuery(internal.knowledgeBase.kb.getFileInternal, {
      fileId: args.fileId,
    });
    if (!file) {
      throw new ConvexError({ code: "FILE_NOT_FOUND" });
    }
    if (file.userId !== userId) {
      throw new ConvexError({ code: "FORBIDDEN" });
    }

    await ctx.runMutation(internal.storage.deleteStorageFile, {
      storageId: file.storageId,
    });
    await ctx.runMutation(internal.knowledgeBase.kb.deleteFileInternal, {
      fileId: file._id,
    });

    console.info(`${label} deleted`);
    return null;
  },
});

export const searchKnowledgeBase = action({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(searchMatchValidator),
  handler: async (ctx, args): Promise<SearchMatch[]> => {
    const label = "[knowledgeBase/kbActions: searchKnowledgeBase]";
    const userId = await requireUserId(ctx, label);

    const { embedding } = await embed({
      model: EMBEDDING_MODEL,
      value: args.query,
    });

    const limit = toSearchLimit(args.limit);

    const vectorResults = await ctx.vectorSearch(
      "knowledgeBaseChunks",
      "by_embedding",
      {
        vector: embedding,
        limit,
        filter: (q) => q.eq("userId", userId),
      }
    );

    if (vectorResults.length === 0) {
      return [];
    }

    return ctx.runQuery(internal.knowledgeBase.kb.hydrateChunkResults, {
      chunkIds: vectorResults.map((r) => r._id),
      userId,
    });
  },
});
