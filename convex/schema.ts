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
});
