"use client";

import { createContext, use } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { ChatMessage, SourceDocumentPart } from "@/lib/types/chat";

export type SubmitPromptFn = (
  prompt: string,
  fileIds: Id<"chatFiles">[]
) => Promise<void>;

export interface ChatThreadContextValue {
  readonly composerKey: string;
  readonly isLoading: boolean;
  readonly isStreaming: boolean;
  readonly messages: ChatMessage[];
  readonly selectedSource: SourceDocumentPart | null;
  readonly setSelectedSource: (part: SourceDocumentPart | null) => void;
  readonly shouldShowThread: boolean;
  readonly stop: () => void;
  readonly submitPrompt: SubmitPromptFn;
}

export const ChatThreadContext = createContext<ChatThreadContextValue | null>(
  null
);

export function useChatThread(): ChatThreadContextValue {
  const ctx = use(ChatThreadContext);
  if (!ctx) {
    throw new Error("useChatThread must be used within a ChatThreadProvider");
  }
  return ctx;
}
