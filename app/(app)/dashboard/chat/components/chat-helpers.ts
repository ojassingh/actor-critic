import type { LucideIcon } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  ChatMessage,
  FilePart,
  MessagePart,
  ReasoningPart,
  SourceDocumentPart,
  SourceUrlPart,
  ToolPart,
} from "@/lib/types/chat";
import { isRecord } from "@/lib/utils";

export interface ChatSuggestion {
  readonly prompt: string;
}

export const chatComposerPlaceholders = {
  followUp: "Ask a follow-up...",
  question: "Ask a question...",
} as const;

const toolActiveStates = new Set(["input-streaming", "input-available"]);

export const _isToolPartActive = (part: ToolPart) => {
  if (!part.state) {
    return false;
  }
  if (toolActiveStates.has(part.state)) {
    return true;
  }
  return part.state === "output-available" && part.preliminary === true;
};

export const getMessageText = (message: ChatMessage): string => {
  return message.parts
    .filter(
      (part): part is Extract<MessagePart, { type: "text" }> =>
        part.type === "text"
    )
    .map((part) => part.text)
    .join("");
};

export const isToolPart = (part: MessagePart): part is ToolPart =>
  part.type.startsWith("tool-");

export const isFilePart = (part: MessagePart): part is FilePart =>
  part.type === "file";

export const isSourceUrlPart = (part: MessagePart): part is SourceUrlPart =>
  part.type === "source-url";

export const isSourceDocumentPart = (
  part: MessagePart
): part is SourceDocumentPart => part.type === "source-document";

interface CategorizedParts {
  fileParts: FilePart[];
  reasoningParts: ReasoningPart[];
  sourceParts: Array<SourceUrlPart | SourceDocumentPart>;
  toolParts: ToolPart[];
}

export const categorizeMessageParts = (
  parts: readonly MessagePart[]
): CategorizedParts => {
  const result: CategorizedParts = {
    reasoningParts: [],
    toolParts: [],
    fileParts: [],
    sourceParts: [],
  };
  for (const part of parts) {
    if (part.type === "reasoning") {
      result.reasoningParts.push(part);
    } else if (isToolPart(part)) {
      result.toolParts.push(part);
    } else if (part.type === "file") {
      result.fileParts.push(part);
    } else if (part.type === "source-url" || part.type === "source-document") {
      result.sourceParts.push(part);
    }
  }
  return result;
};

const toolDisplayMap: Record<
  string,
  { label: string; runningLabel?: string; icon: LucideIcon } | undefined
> = {};

export const getToolDisplay = (toolName: string) => toolDisplayMap[toolName];

export const getToolLabel = (toolName: string) => {
  const display = getToolDisplay(toolName);
  return display?.label ?? `${toolName.replace(/[:_-]/g, " ")}.`;
};

export const getToolRunningLabel = (toolName: string) => {
  const display = getToolDisplay(toolName);
  return display?.runningLabel ?? getToolLabel(toolName);
};

export const getFileUrl = (part: FilePart) => {
  const mediaType = part.mediaType ?? "application/octet-stream";
  const url = part.url ?? "";
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  return `data:${mediaType};base64,${url}`;
};

export const genericSuggestions = [
  {
    prompt:
      "Verify the claim: Flublok ensures identical antigenic match with WHO- and FDA-selected flu strains.",
  },
  {
    prompt:
      "Verify the claim: Flublok contains 3x the hemagglutinin (HA) antigen content of standard-dose flu vaccines, which has been linked to greater immunogenicity vs standard-dose flu vaccines.",
  },
  {
    prompt:
      "Verify the claim: Cell- and egg-based flu vaccines have the potential to develop mutations during production, which may reduce their effectiveness.",
  },
  {
    prompt:
      "Verify the claim: Recombinant technology leads to a broader immune response that may provide cross-protection, even in a mismatch season.",
  },
] as const satisfies readonly ChatSuggestion[];

export const getChatFileIds = (metadata: unknown): Id<"chatFiles">[] => {
  if (!isRecord(metadata)) {
    return [];
  }
  const raw = metadata.chatFileIds;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (value): value is Id<"chatFiles"> => typeof value === "string"
  );
};
