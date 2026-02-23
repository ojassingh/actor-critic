import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  chatThreads: defineTable({
    userId: v.string(),
    title: v.string(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
  chatMessages: defineTable({
    threadId: v.id("chatThreads"),
    userId: v.optional(v.string()),
    role: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("assistant")
    ),
    messageId: v.string(),
    parts: v.array(v.any()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_threadId", ["threadId"])
    .index("by_threadId_and_createdAt", ["threadId", "createdAt"]),
  chatFiles: defineTable({
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
  })
    .index("by_userId", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),
  knowledgeBaseFiles: defineTable({
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
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"]),
  knowledgeBaseChunks: defineTable({
    userId: v.string(),
    fileId: v.id("knowledgeBaseFiles"),
    chunkIndex: v.number(),
    content: v.string(),
    embed: v.string(),
    embedding: v.array(v.float64()),
  })
    .index("by_fileId", ["fileId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["userId"],
    }),
});
