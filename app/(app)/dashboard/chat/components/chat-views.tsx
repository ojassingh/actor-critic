"use client";

import { useAction } from "convex/react";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Paperclip,
  Square,
  X,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import {
  FileUpload,
  FileUploadContent,
  FileUploadTrigger,
} from "@/components/ui/ai/file-upload";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useChatAttachments } from "@/hooks/use-chat-attachments";
import type {
  ChatAttachment,
  ChatMessage as ChatMessageType,
} from "@/lib/types/chat";
import { cn } from "@/lib/utils";
import type { SubmitPromptFn } from "./chat-context";
import { useChatThread } from "./chat-context";
import { type ChatSuggestion, chatComposerPlaceholders } from "./chat-helpers";
import { ChatMessage } from "./chat-message";
import { ChatSuggestionCard } from "./chat-suggestion-card";

const STREAMING_ASSISTANT_MESSAGE_ID = "__streaming_assistant__" as const;
const STREAMING_ASSISTANT_PLACEHOLDER: ChatMessageType = {
  id: STREAMING_ASSISTANT_MESSAGE_ID,
  role: "assistant",
  parts: [],
};

export function ChatLandingHeader({
  className,
  titleClassName,
}: {
  className?: string;
  titleClassName?: string;
}) {
  return (
    <div className={cn("text-center", className)}>
      <p className={cn("font-normal text-2xl tracking-tight", titleClassName)}>
        How can I help you today?
      </p>
      <p className="mt-1 text-muted-foreground">
        If you&apos;re not sure where to start, choose one of the options below.
      </p>
    </div>
  );
}

export function ChatSuggestionGrid({
  suggestions,
  onSubmitPrompt,
  className,
}: {
  suggestions: readonly ChatSuggestion[];
  onSubmitPrompt: SubmitPromptFn;
  className?: string;
}) {
  const handleSuggestionSelect = (prompt: string) => {
    onSubmitPrompt(prompt, []).catch(() => undefined);
  };

  return (
    <div className={cn("grid gap-3 md:grid-cols-2", className)}>
      {suggestions.map((suggestion) => (
        <ChatSuggestionCard
          key={suggestion.prompt}
          onSelect={handleSuggestionSelect}
          prompt={suggestion.prompt}
        />
      ))}
    </div>
  );
}

export function PromptComposer({ placeholder }: { placeholder: string }) {
  const { composerKey, isStreaming, stop, submitPrompt } = useChatThread();

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generateUploadUrl = useAction(api.storage.generateUploadUrl);
  const registerUpload = useAction(api.chat.filesActions.registerUpload);

  const { addFiles } = useChatAttachments({
    key: composerKey,
    addAttachments: (_key, next) => {
      setAttachments((previous) => [...previous, ...next]);
    },
    updateAttachment: (_key, id, update) => {
      setAttachments((previous) =>
        previous.map((attachment) =>
          attachment.id === id ? update(attachment) : attachment
        )
      );
    },
    generateUploadUrl,
    registerUpload,
  });

  const removeFile = (id: string) => {
    setAttachments((previous) =>
      previous.filter((attachment) => attachment.id !== id)
    );
  };

  const isUploading = attachments.some(
    (attachment) => attachment.status === "uploading"
  );
  const hasUploadErrors = attachments.some(
    (attachment) => attachment.status === "error"
  );
  const chatFileIds = attachments.flatMap((attachment) =>
    attachment.status === "ready" && attachment.chatFileId
      ? [attachment.chatFileId]
      : []
  );

  const isPending = isSubmitting || isUploading;

  const submit = async () => {
    const trimmed = input.trim();
    if (!trimmed || isPending || hasUploadErrors) {
      return;
    }
    setIsSubmitting(true);
    setInput("");
    setAttachments([]);
    try {
      await submitPrompt(trimmed, chatFileIds);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const shouldSubmit =
      event.key === "Enter" && !event.shiftKey && !isStreaming;
    if (!shouldSubmit) {
      return;
    }

    event.preventDefault();
    submit().catch(() => undefined);
  };
  const isActionDisabled = isStreaming || isPending || !input.trim();
  const showStop = isStreaming;
  let actionIcon = <ArrowUp />;
  if (showStop) {
    actionIcon = <Square />;
  } else if (isPending) {
    actionIcon = <Loader2 className="size-4 animate-spin" />;
  }

  return (
    <FileUpload disabled={isPending} onFilesAdded={addFiles}>
      <div
        aria-disabled={isPending}
        className="cursor-text rounded-xl border border-input bg-background p-2 shadow-md backdrop-blur-sm dark:bg-card"
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1 pt-1">
            {attachments.map((attachment) => (
              <div
                className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs"
                key={attachment.id}
              >
                <span className="max-w-40 truncate">
                  {attachment.file.name}
                </span>
                {attachment.status === "uploading" && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Uploading…
                  </span>
                )}
                {attachment.status === "error" && (
                  <span className="text-destructive">Failed</span>
                )}
                <button
                  aria-label={`Remove ${attachment.file.name}`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => removeFile(attachment.id)}
                  type="button"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <Textarea
          className="min-h-[44px] resize-none border-none shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          value={input}
        />
        <div className="flex items-center justify-between">
          <FileUploadTrigger asChild>
            <Button size="icon" type="button" variant="ghost">
              <Paperclip />
            </Button>
          </FileUploadTrigger>
          <Button
            aria-label={showStop ? "Stop response" : "Send message"}
            className="rounded-full bg-primary text-primary-foreground"
            disabled={!showStop && isActionDisabled}
            onClick={showStop ? stop : submit}
            size="icon"
            type="button"
            variant="ghost"
          >
            {actionIcon}
          </Button>
        </div>
      </div>
      <FileUploadContent>
        <div className="rounded-xl border bg-background px-6 py-4 text-center text-muted-foreground text-sm shadow-lg">
          Drop files to attach
        </div>
      </FileUploadContent>
    </FileUpload>
  );
}

interface ThreadViewProps {
  composerPlaceholder?: string;
  contentBottomPaddingClassName?: string;
  showComposer?: boolean;
}

const getMessageKey = (message: ChatMessageType, index: number) =>
  message.id?.trim() || `${message.role}-${index}`;

export function ThreadView({
  showComposer = true,
  contentBottomPaddingClassName,
  composerPlaceholder = chatComposerPlaceholders.followUp,
}: ThreadViewProps) {
  const { messages, isLoading, isStreaming, composerKey } = useChatThread();

  const shouldShowAssistantPlaceholder =
    isStreaming && messages.at(-1)?.role === "user";
  const messagesForDisplay = shouldShowAssistantPlaceholder
    ? [...messages, STREAMING_ASSISTANT_PLACEHOLDER]
    : messages;

  const lastIdx = messagesForDisplay.findLastIndex(
    (message) => message.role === "assistant"
  );

  const contentBottomPadding =
    contentBottomPaddingClassName ?? (showComposer ? "pb-40" : "pb-6");

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <StickToBottom
        className="relative min-h-0 min-w-0 flex-1"
        initial="smooth"
        resize={isStreaming ? "smooth" : "instant"}
      >
        <StickToBottom.Content
          className={cn(
            "mx-auto w-full min-w-0 max-w-3xl space-y-4 pt-10",
            contentBottomPadding
          )}
        >
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-6 w-3/5" />
            </div>
          ) : (
            messagesForDisplay.map((message, index) => (
              <ChatMessage
                isLatestAssistant={lastIdx === index}
                isStreaming={isStreaming}
                key={getMessageKey(message, index)}
                message={message}
              />
            ))
          )}
        </StickToBottom.Content>
        <ScrollToBottomButton />
      </StickToBottom>
      {showComposer ? (
        <div className="sticky bottom-4 z-10 mx-auto w-full min-w-0 max-w-3xl shadow-md dark:bg-transparent">
          <PromptComposer key={composerKey} placeholder={composerPlaceholder} />
        </div>
      ) : null}
    </div>
  );
}

export function EmptyThreadView({
  suggestions,
  composerPlaceholder = chatComposerPlaceholders.question,
  titleClassName,
}: {
  suggestions: readonly ChatSuggestion[];
  composerPlaceholder?: string;
  titleClassName?: string;
}) {
  const { composerKey, submitPrompt } = useChatThread();

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex flex-1 items-center justify-center">
        <div className="grid w-full max-w-2xl gap-4">
          <ChatLandingHeader titleClassName={titleClassName} />
          <ChatSuggestionGrid
            className="mt-4"
            onSubmitPrompt={submitPrompt}
            suggestions={suggestions}
          />
        </div>
      </div>
      <div className="mx-auto mt-4 w-full min-w-0 max-w-2xl pb-4">
        <PromptComposer key={composerKey} placeholder={composerPlaceholder} />
      </div>
    </div>
  );
}

function ScrollToBottomButton() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) {
    return null;
  }
  return (
    <button
      className="absolute right-4 bottom-4 rounded-full border bg-background p-2 text-muted-foreground shadow-sm transition hover:text-foreground"
      onClick={() => {
        scrollToBottom();
      }}
      type="button"
    >
      <ArrowDown className="size-4" />
    </button>
  );
}
