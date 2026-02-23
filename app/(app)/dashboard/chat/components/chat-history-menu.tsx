"use client";

import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChatThreadId, ChatThreadSummary } from "@/lib/types/chat";
import { cn, formatRelativeTime } from "@/lib/utils";

interface ChatHistoryMenuProps {
  className?: string;
  isDisabled: boolean;
  onSelect: (threadId: ChatThreadId) => void;
  threads: ChatThreadSummary[] | undefined;
}

export function ChatHistoryMenu({
  isDisabled,
  threads,
  onSelect,
  className,
}: ChatHistoryMenuProps) {
  return (
    <div className={cn("", className)}>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                disabled={isDisabled}
                size="sm"
                type="button"
                variant="ghost"
              >
                <History className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">History</TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          align="end"
          className="max-h-72 w-72 overflow-y-auto"
        >
          {threads === undefined && (
            <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
          )}
          {threads?.length === 0 && (
            <DropdownMenuItem disabled>No conversations</DropdownMenuItem>
          )}
          {threads?.map((thread) => (
            <DropdownMenuItem
              key={thread._id}
              onSelect={() => onSelect(thread._id)}
            >
              <div className="flex w-full items-center justify-between gap-3">
                <span className="max-w-44 truncate">
                  {thread.title ?? "Untitled chat"}
                </span>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {formatRelativeTime(thread._creationTime)}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
