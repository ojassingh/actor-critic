"use client";

import { useChat } from "@ai-sdk/react";
import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { handleError } from "@/lib/handle-error";
import type { ChatMessage, ChatThreadId } from "@/lib/types/chat";
import { cn } from "@/lib/utils";
import { ChatThreadContext, useChatThread } from "./chat-context";
import {
  type ChatSuggestion,
  chatComposerPlaceholders,
  genericSuggestions,
} from "./chat-helpers";
import { ChatHistoryMenu } from "./chat-history-menu";
import {
  ChatLandingHeader,
  ChatSuggestionGrid,
  EmptyThreadView,
  PromptComposer,
  ThreadView,
} from "./chat-views";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const COMPOSER_MOVE_TRANSITION = { duration: 0.4, ease: EASE_OUT } as const;

interface ChatThreadProps {
  className?: string;
  emptyStateLayout?: "default" | "composerCenteredCardsBelow";
  emptyStateTitleClassName?: string;
  onNavigateToLanding?: () => void;
  onThreadSelect?: (threadId: ChatThreadId) => void;
  threadId?: ChatThreadId;
}

export function ChatThread({
  threadId,
  className,
  onThreadSelect,
  onNavigateToLanding,
  emptyStateLayout = "default",
  emptyStateTitleClassName,
}: ChatThreadProps) {
  const [localThreadId, setLocalThreadId] = useState<ChatThreadId | null>(null);
  const activeThreadId = threadId ?? localThreadId ?? undefined;
  const hasActiveThread = activeThreadId !== undefined;

  const [localSessionKey, setLocalSessionKey] = useState<string>(() => {
    return `new-${crypto.randomUUID()}`;
  });
  const chatSessionKey = threadId ?? localSessionKey;

  const threads = useQuery(api.chat.threads.listThreads, { limit: 50 });
  const createThread = useMutation(api.chat.threads.createThread);
  const threadMessages = useQuery(
    api.chat.messages.listByThread,
    activeThreadId ? { threadId: activeThreadId } : "skip"
  );
  const {
    messages: liveMessages,
    sendMessage,
    stop,
    status,
  } = useChat<ChatMessage>({
    id: chatSessionKey,
    onError: (response) => {
      handleError(response);
    },
  });
  const isStreaming = status === "submitted" || status === "streaming";
  const isHistoryDisabled = threads?.length === 0;
  const persistedMessages = useMemo(() => {
    if (!threadMessages) {
      return [];
    }
    return threadMessages.map((message) => ({
      id: message.messageId,
      role: message.role,
      parts: message.parts,
      metadata: message.metadata,
    }));
  }, [threadMessages]);
  const shownMessages = useMemo(() => {
    if (isStreaming) {
      return liveMessages;
    }
    if (!hasActiveThread) {
      return liveMessages.length > 0 ? liveMessages : persistedMessages;
    }
    return persistedMessages.length > 0 ? persistedMessages : liveMessages;
  }, [hasActiveThread, isStreaming, liveMessages, persistedMessages]);
  const isLoading =
    activeThreadId !== undefined &&
    threadMessages === undefined &&
    shownMessages.length === 0;

  const submitPrompt = useCallback(
    async (prompt: string, fileIds: Id<"chatFiles">[]) => {
      let targetThreadId = activeThreadId;
      if (!targetThreadId) {
        try {
          targetThreadId = await createThread({ message: prompt });
          setLocalThreadId(targetThreadId);
        } catch (error) {
          handleError(error);
          return;
        }
      }
      try {
        await sendMessage(
          {
            text: prompt,
            metadata: fileIds.length > 0 ? { chatFileIds: fileIds } : undefined,
          },
          {
            body: {
              threadId: targetThreadId,
              chatFileIds: fileIds.length > 0 ? fileIds : undefined,
            },
          }
        );
      } catch (error) {
        handleError(error);
      }
    },
    [activeThreadId, createThread, sendMessage]
  );

  const shouldShowThread =
    hasActiveThread || liveMessages.length > 0 || isStreaming;
  const contextValue = useMemo(
    () => ({
      messages: shownMessages,
      isStreaming,
      isLoading,
      composerKey: chatSessionKey,
      shouldShowThread,
      submitPrompt,
      stop,
    }),
    [
      shownMessages,
      isStreaming,
      isLoading,
      chatSessionKey,
      shouldShowThread,
      submitPrompt,
      stop,
    ]
  );

  return (
    <ChatThreadContext value={contextValue}>
      <div
        className={cn(
          "relative flex h-full w-full min-w-0 flex-col",
          className
        )}
      >
        <div className="absolute top-2 right-2 z-20 flex items-center gap-2">
          <ChatHistoryMenu
            isDisabled={isHistoryDisabled}
            onSelect={(selectedThreadId) => {
              setLocalThreadId(selectedThreadId);
              setLocalSessionKey(selectedThreadId);
              onThreadSelect?.(selectedThreadId);
            }}
            threads={threads}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => {
                  if (onNavigateToLanding) {
                    onNavigateToLanding();
                    return;
                  }
                  setLocalThreadId(null);
                  setLocalSessionKey(`new-${crypto.randomUUID()}`);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New chat</TooltipContent>
          </Tooltip>
        </div>
        {emptyStateLayout === "composerCenteredCardsBelow" ? (
          <ComposerCenteredChatLayout
            shouldAnimateComposer={threadId === undefined}
            suggestions={genericSuggestions}
            titleClassName={emptyStateTitleClassName}
          />
        ) : (
          <DefaultChatLayout
            suggestions={genericSuggestions}
            titleClassName={emptyStateTitleClassName}
          />
        )}
      </div>
    </ChatThreadContext>
  );
}

function DefaultChatLayout({
  suggestions,
  titleClassName,
}: {
  readonly suggestions: readonly ChatSuggestion[];
  readonly titleClassName?: string;
}) {
  const { shouldShowThread } = useChatThread();

  if (shouldShowThread) {
    return <ThreadView />;
  }

  return (
    <EmptyThreadView
      suggestions={suggestions}
      titleClassName={titleClassName}
    />
  );
}

function ComposerCenteredChatLayout({
  shouldAnimateComposer,
  suggestions,
  titleClassName,
}: {
  readonly shouldAnimateComposer: boolean;
  readonly suggestions: readonly ChatSuggestion[];
  readonly titleClassName?: string;
}) {
  const { shouldShowThread, composerKey, submitPrompt } = useChatThread();

  const composerContainerClassName = cn(
    "mx-auto w-full px-4",
    shouldShowThread
      ? "max-w-3xl"
      : "flex max-w-2xl flex-1 flex-col justify-center"
  );

  const composerPlaceholder = shouldShowThread
    ? chatComposerPlaceholders.followUp
    : chatComposerPlaceholders.question;

  const composerArea = (
    <>
      {!shouldShowThread && (
        <ChatLandingHeader className="mb-4" titleClassName={titleClassName} />
      )}
      <PromptComposer key={composerKey} placeholder={composerPlaceholder} />
      {!shouldShowThread && (
        <ChatSuggestionGrid
          className="mt-6"
          onSubmitPrompt={submitPrompt}
          suggestions={suggestions}
        />
      )}
    </>
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col pb-4">
      {shouldShowThread ? (
        <div className="min-h-0 flex-1">
          <ThreadView
            contentBottomPaddingClassName="pb-6"
            showComposer={false}
          />
        </div>
      ) : null}

      {shouldAnimateComposer ? (
        <motion.div
          className={composerContainerClassName}
          layout="position"
          transition={COMPOSER_MOVE_TRANSITION}
        >
          {composerArea}
        </motion.div>
      ) : (
        <div className={composerContainerClassName}>{composerArea}</div>
      )}
    </div>
  );
}
