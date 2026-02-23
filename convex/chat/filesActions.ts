"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { extractTextFromPdfBase64 } from "../ocr";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_PAGES = 5;
const EXPIRES_MS = 24 * 60 * 60 * 1000;

const isAllowedContentType = (contentType: string): boolean =>
  contentType === "application/pdf" || contentType.startsWith("image/");

export const registerUpload = action({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
  },
  returns: v.object({
    chatFileId: v.id("chatFiles"),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    chatFileId: Id<"chatFiles">;
  }> => {
    const label = "[chat/filesActions: registerUpload]";
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      console.error(`${label} unauthorized`);
      throw new ConvexError({ code: "AUTH_UNAUTHORIZED" });
    }

    const metadata: { contentType?: string; size: number } = await ctx.runQuery(
      internal.chat.files.getStorageMetadata,
      {
        storageId: args.storageId,
      }
    );
    const contentType: string = metadata.contentType ?? "";
    if (!isAllowedContentType(contentType)) {
      await ctx.runMutation(internal.chat.files.deleteStorageFile, {
        storageId: args.storageId,
      });
      console.error(`${label} unsupported content type`);
      throw new ConvexError({ code: "UNSUPPORTED_CONTENT_TYPE" });
    }
    if (metadata.size > MAX_FILE_BYTES) {
      await ctx.runMutation(internal.chat.files.deleteStorageFile, {
        storageId: args.storageId,
      });
      console.error(`${label} file too large`);
      throw new ConvexError({ code: "FILE_TOO_LARGE" });
    }

    // Ensure the uploaded file exists before inserting metadata.
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) {
      console.error(`${label} storage file missing`);
      throw new ConvexError({ code: "FILE_NOT_FOUND" });
    }

    let markdown: string | undefined;
    if (contentType === "application/pdf") {
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        markdown = await extractTextFromPdfBase64(base64, MAX_PDF_PAGES);
      } catch (error) {
        await ctx.runMutation(internal.chat.files.deleteStorageFile, {
          storageId: args.storageId,
        });
        console.error(`${label} PDF OCR failed`);
        throw error;
      }
    }

    let chatFileId: Id<"chatFiles">;
    try {
      chatFileId = await ctx.runMutation(internal.chat.files.insertChatFile, {
        userId: identity.subject,
        filename: args.filename,
        contentType,
        size: metadata.size,
        storageId: args.storageId,
        markdown,
        expiresAt: Date.now() + EXPIRES_MS,
      });
    } catch (error) {
      await ctx.runMutation(internal.chat.files.deleteStorageFile, {
        storageId: args.storageId,
      });
      console.error(`${label} failed to insert chat file`);
      throw error;
    }

    console.info(`${label} file registered`);
    return { chatFileId };
  },
});
