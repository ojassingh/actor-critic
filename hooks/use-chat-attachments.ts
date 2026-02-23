"use client";

import { useCallback } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { handleError } from "@/lib/handle-error";
import type { ChatAttachment } from "@/lib/types/chat";

interface UseChatAttachmentsArgs {
  addAttachments: (key: string, attachments: ChatAttachment[]) => void;
  generateUploadUrl: () => Promise<string>;
  key: string;
  registerUpload: (args: {
    storageId: Id<"_storage">;
    filename: string;
  }) => Promise<{ chatFileId: Id<"chatFiles"> }>;
  updateAttachment: (
    key: string,
    id: string,
    update: (attachment: ChatAttachment) => ChatAttachment
  ) => void;
}

export const useChatAttachments = ({
  key,
  addAttachments,
  updateAttachment,
  generateUploadUrl,
  registerUpload,
}: UseChatAttachmentsArgs) => {
  const uploadAttachment = useCallback(
    async (attachment: ChatAttachment) => {
      try {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            "Content-Type": attachment.file.type || "application/octet-stream",
          },
          body: attachment.file,
        });
        if (!response.ok) {
          throw new Error("Upload failed");
        }
        const json: { storageId: Id<"_storage"> } = await response.json();
        const result = await registerUpload({
          storageId: json.storageId,
          filename: attachment.file.name,
        });
        updateAttachment(key, attachment.id, (file) => ({
          ...file,
          status: "ready",
          chatFileId: result.chatFileId,
        }));
      } catch (error) {
        updateAttachment(key, attachment.id, (file) => ({
          ...file,
          status: "error",
          error: "Upload failed",
        }));
        handleError(error);
      }
    },
    [generateUploadUrl, key, registerUpload, updateAttachment]
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const newAttachments = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        status: "uploading" as const,
      }));
      addAttachments(key, newAttachments);
      for (const attachment of newAttachments) {
        uploadAttachment(attachment).catch(() => {
          return;
        });
      }
    },
    [addAttachments, key, uploadAttachment]
  );

  return { addFiles };
};
