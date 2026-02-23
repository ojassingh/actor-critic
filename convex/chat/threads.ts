import { generateText } from "ai";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from "../_generated/server";

const DEFAULT_THREAD_TITLE = "New chat";
const WHITESPACE_REGEX = /\s+/;

export const listThreads = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("chatThreads"),
      _creationTime: v.number(),
      userId: v.string(),
      title: v.string(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject ?? null;
    if (!userId) {
      return [];
    }
    return await ctx.db
      .query("chatThreads")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const createThread = mutation({
  args: { message: v.optional(v.string()) },
  returns: v.id("chatThreads"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "AUTH_UNAUTHORIZED" });
    }
    const userId = identity.subject;
    const threadId = await ctx.db.insert("chatThreads", {
      userId,
      title: DEFAULT_THREAD_TITLE,
      updatedAt: Date.now(),
    });
    if (args.message) {
      await ctx.scheduler.runAfter(
        0,
        internal.chat.threads.generateThreadTitle,
        {
          threadId,
          userId,
          message: args.message,
        }
      );
    }
    return threadId;
  },
});

export const getThread = query({
  args: { threadId: v.id("chatThreads") },
  returns: v.union(
    v.object({
      _id: v.id("chatThreads"),
      _creationTime: v.number(),
      userId: v.string(),
      title: v.string(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== identity.subject) {
      return null;
    }
    return thread;
  },
});

export const updateThreadTitleInternal = internalMutation({
  args: {
    threadId: v.id("chatThreads"),
    title: v.string(),
    userId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (
      !thread ||
      thread.userId !== args.userId ||
      thread.title !== DEFAULT_THREAD_TITLE
    ) {
      return null;
    }
    await ctx.db.patch(args.threadId, {
      title: args.title,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const generateThreadTitle = internalAction({
  args: {
    threadId: v.id("chatThreads"),
    message: v.string(),
    userId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { text } = await generateText({
      model: "xai/grok-4.1-fast-non-reasoning",
      system:
        "Write a 3-5 word Title Case chat title from the user's first message. No quotes.",
      prompt: `The user's message is: ${args.message}`,
    });

    const words = text
      .split(WHITESPACE_REGEX)
      .filter(Boolean)
      .slice(0, 5)
      .join(" ");

    await ctx.runMutation(internal.chat.threads.updateThreadTitleInternal, {
      threadId: args.threadId,
      title: words || DEFAULT_THREAD_TITLE,
      userId: args.userId,
    });

    return null;
  },
});
