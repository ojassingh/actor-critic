import type { InferUITools, UIDataTypes, UIMessage } from "ai";
import type { Doc, Id } from "@/convex/_generated/dataModel";

export type ChatMessage = UIMessage<unknown, UIDataTypes, InferUITools<never>>;

export type ChatThreadId = Id<"chatThreads">;
export type ChatThreadSummary = Pick<
  Doc<"chatThreads">,
  "_id" | "_creationTime" | "title"
>;

export type MessagePart = ChatMessage["parts"][number];
type MessagePartOf<Type extends MessagePart["type"]> = Extract<
  MessagePart,
  { type: Type }
>;

export type ReasoningPart = MessagePartOf<"reasoning">;
export type StepStartPart = MessagePartOf<"step-start">;
export type FilePart = MessagePartOf<"file">;
export type SourceUrlPart = MessagePartOf<"source-url">;
export type SourceDocumentPart = MessagePartOf<"source-document">;

export type ToolPartState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

export type ToolPart = Extract<MessagePart, { type: `tool-${string}` }> & {
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  state?: ToolPartState;
  preliminary?: boolean;
  errorText?: string;
};

export const chatAttachmentStatuses = ["uploading", "ready", "error"] as const;
export type ChatAttachmentStatus = (typeof chatAttachmentStatuses)[number];

export interface ChatAttachment {
  chatFileId?: Id<"chatFiles">;
  error?: string;
  file: File;
  id: string;
  status: ChatAttachmentStatus;
}
