"use client";

import { useQuery } from "convex/react";
import { FileText, Loader } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "@/components/ui/ai/chain-of-thought";
import { Message, MessageContent } from "@/components/ui/ai/message";
import {
  Source,
  SourceContent,
  SourceTrigger,
} from "@/components/ui/ai/source";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { api } from "@/convex/_generated/api";
import type {
  ChatMessage as ChatMessageType,
  FilePart,
  SourceDocumentPart,
  SourceUrlPart,
  ToolPart,
} from "@/lib/types/chat";
import { cn } from "@/lib/utils";
import {
  _isToolPartActive,
  categorizeMessageParts,
  getChatFileIds,
  getFileUrl,
  getMessageText,
  getToolDisplay,
  getToolLabel,
  getToolRunningLabel,
  isSourceUrlPart,
} from "./chat-helpers";

export function ChatMessage({
  message,
  isLatestAssistant,
  isStreaming,
}: {
  message: ChatMessageType;
  isLatestAssistant: boolean;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";
  const messageText = getMessageText(message);
  const hasVisibleText = messageText.trim().length > 0;
  const {
    reasoningParts,
    toolParts,
    fileParts: messageFileParts,
    sourceParts,
  } = categorizeMessageParts(message.parts);
  const reasoningText = reasoningParts.map((part) => part.text).join("\n\n");
  const hasReasoning = !isUser && reasoningText.trim().length > 0;
  const isToolRunning = toolParts.some(_isToolPartActive);
  const hasToolParts = toolParts.length > 0;
  const isActive = isStreaming && isLatestAssistant;
  const showThinkingInTimeline =
    !isUser && isActive && hasToolParts && !hasVisibleText && !hasReasoning;
  const showShimmer =
    !isUser && isActive && !hasVisibleText && !hasToolParts && !hasReasoning;

  const chatFileIds = getChatFileIds(message.metadata);
  const attachedFiles = useQuery(
    api.chat.files.getFilesForChat,
    chatFileIds.length > 0 ? { chatFileIds } : "skip"
  );
  const attachmentParts: FilePart[] =
    attachedFiles?.map((file) => ({
      type: "file",
      mediaType: file.contentType,
      filename: file.filename,
      url: file.url,
    })) ?? [];

  const fileParts = [...messageFileParts, ...attachmentParts];

  let textContent: ReactNode = null;
  if (showShimmer) {
    textContent = (
      <div className="flex items-start">
        <span
          aria-hidden="true"
          className="mt-2.5 size-2 shrink-0 rounded-full bg-primary"
        />
        <div className="prose prose-sm min-w-0 max-w-[75%] whitespace-normal px-3 py-1 text-sm text-white">
          <TextShimmer>Thinking...</TextShimmer>
        </div>
      </div>
    );
  } else if (hasVisibleText) {
    textContent = isUser ? (
      <div className="prose prose-sm min-w-0 max-w-[75%] whitespace-normal rounded-xl bg-primary/60 px-3 py-1 text-sm text-white">
        {messageText}
      </div>
    ) : (
      <div className="flex items-start">
        <span
          aria-hidden="true"
          className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
        />
        <MessageContent
          className="min-w-0 max-w-[75%] text-foreground text-sm"
          markdown
        >
          {messageText}
        </MessageContent>
      </div>
    );
  }

  return (
    <Message className={cn("gap-3", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "flex w-full min-w-0 flex-col gap-2",
          isUser ? "items-end" : "items-start"
        )}
      >
        {(hasToolParts || hasReasoning) && (
          <ToolTimeline
            isStreaming={isActive || isToolRunning}
            reasoningText={hasReasoning ? reasoningText : undefined}
            showThinkingStep={showThinkingInTimeline}
            toolParts={toolParts}
          />
        )}
        {textContent}
        {fileParts.length > 0 && <FileList fileParts={fileParts} />}
        {sourceParts.length > 0 && <SourceList sourceParts={sourceParts} />}
      </div>
    </Message>
  );
}

function ToolTimeline({
  toolParts,
  isStreaming,
  showThinkingStep,
  reasoningText,
}: {
  toolParts: ToolPart[];
  isStreaming: boolean;
  showThinkingStep: boolean;
  reasoningText?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const hasReasoning = Boolean(reasoningText?.trim());

  useEffect(() => {
    if (isStreaming || showThinkingStep) {
      setIsOpen(true);
    }
  }, [isStreaming, showThinkingStep]);

  const headerText = toolParts.length > 0 ? "Chain of Thought" : "Thinking";

  return (
    <div className="w-full">
      <ChainOfThought
        onOpenChange={setIsOpen}
        open={isStreaming || showThinkingStep || isOpen}
      >
        <ChainOfThoughtHeader className="text-sm">
          {headerText}
        </ChainOfThoughtHeader>
        <ChainOfThoughtContent>
          {hasReasoning && (
            <ChainOfThoughtStep
              className="text-muted-foreground text-sm"
              label="Thinking"
              status={isStreaming ? "active" : "complete"}
            >
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted px-3 py-2 text-xs">
                {reasoningText}
              </pre>
            </ChainOfThoughtStep>
          )}
          {toolParts.map((part, index) => {
            const toolName = part.type.replace("tool-", "");
            const errorText = part.errorText;
            const isRunning = _isToolPartActive(part);
            const status = isRunning ? "active" : "complete";
            const toolKey =
              part.toolCallId ??
              `${part.type}-${part.state ?? "state"}-${index.toString()}`;
            const display = getToolDisplay(toolName);
            const labelText = isRunning
              ? getToolRunningLabel(toolName)
              : getToolLabel(toolName);
            const label = isRunning ? (
              <TextShimmer>{labelText}</TextShimmer>
            ) : (
              labelText
            );

            return (
              <ChainOfThoughtStep
                className="text-muted-foreground text-sm"
                icon={isRunning ? Loader : display?.icon}
                iconClassName={cn(
                  "size-3 text-muted-foreground",
                  isRunning && "animate-spin"
                )}
                key={toolKey}
                label={label}
                status={status}
              >
                {errorText && (
                  <div className="text-destructive text-xs">{errorText}</div>
                )}
              </ChainOfThoughtStep>
            );
          })}
          {showThinkingStep && (
            <ChainOfThoughtStep
              className="text-sm"
              iconClassName="size-3"
              label={<TextShimmer>Thinking...</TextShimmer>}
              status="active"
            />
          )}
        </ChainOfThoughtContent>
      </ChainOfThought>
    </div>
  );
}

function FileList({ fileParts }: { fileParts: FilePart[] }) {
  return (
    <div className="flex w-full flex-col items-end space-y-2">
      {fileParts.map((part) => {
        const fileUrl = getFileUrl(part);
        const isImage = part.mediaType?.startsWith("image/");
        const name = part.filename ?? "Attachment";
        const fileKey = `${part.url ?? "file"}-${part.filename ?? "name"}`;

        return (
          <Link
            href={fileUrl}
            key={fileKey}
            rel="noopener noreferrer"
            target="_blank"
          >
            <div className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2">
              {isImage ? (
                <div className="shrink-0 overflow-hidden rounded-lg border">
                  <Image
                    alt={name}
                    className="h-12 w-12 object-cover"
                    height={20}
                    src={fileUrl}
                    unoptimized
                    width={20}
                  />
                </div>
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted">
                  <FileText className="size-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{name}</div>
                <div className="truncate text-muted-foreground text-xs">
                  {part.mediaType}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function SourceList({
  sourceParts,
}: {
  sourceParts: Array<SourceUrlPart | SourceDocumentPart>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {sourceParts.map((part, index) => {
        if (isSourceUrlPart(part)) {
          const title = part.title ?? part.url;
          const sourceKey =
            part.sourceId ?? part.url ?? `source-${index.toString()}`;
          return (
            <Source href={part.url} key={sourceKey}>
              <SourceTrigger label={title} showFavicon />
              <SourceContent description={part.url} title={title} />
            </Source>
          );
        }

        const href = `#source-${part.sourceId}`;
        const title = part.title ?? part.filename ?? "Document";
        const description = part.mediaType ?? "Document";
        return (
          <Source
            href={href}
            key={part.sourceId ?? `source-${index.toString()}`}
          >
            <SourceTrigger label={title} />
            <SourceContent description={description} title={title} />
          </Source>
        );
      })}
    </div>
  );
}
