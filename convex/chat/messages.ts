import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalMutation, query } from "../_generated/server";

const stripFileParts = (parts: unknown[]) =>
  parts.filter((part) => {
    if (typeof part !== "object" || part === null) {
      return true;
    }
    const partType = (part as { type?: unknown }).type;
    if (partType === "file") {
      return false;
    }
    return true;
  });

const messageSchema = v.object({
  _id: v.id("chatMessages"),
  _creationTime: v.number(),
  threadId: v.id("chatThreads"),
  userId: v.optional(v.string()),
  role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
  messageId: v.string(),
  parts: v.array(v.any()),
  metadata: v.optional(v.any()),
  createdAt: v.number(),
});

export const listByThread = query({
  args: { threadId: v.id("chatThreads") },
  returns: v.array(messageSchema),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== identity.subject) {
      return [];
    }
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_threadId_and_createdAt", (q) =>
        q.eq("threadId", args.threadId)
      )
      .order("asc")
      .collect();
  },
});

export const appendMessageInternal = internalMutation({
  args: {
    threadId: v.id("chatThreads"),
    role: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("assistant")
    ),
    messageId: v.string(),
    parts: v.array(v.any()),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "AUTH_UNAUTHORIZED" });
    }
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== identity.subject) {
      throw new ConvexError({ code: "THREAD_NOT_FOUND" });
    }
    await ctx.db.insert("chatMessages", {
      threadId: args.threadId,
      userId: args.role === "user" ? identity.subject : undefined,
      role: args.role,
      messageId: args.messageId,
      parts: stripFileParts(args.parts),
      metadata: args.metadata,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const appendMessage = action({
  args: {
    threadId: v.id("chatThreads"),
    role: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("assistant")
    ),
    messageId: v.string(),
    parts: v.array(v.any()),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.chat.messages.appendMessageInternal, args);
    return null;
  },
});
