import {
  consumeStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  Output,
  type StreamTextResult,
  type streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fetchAuthAction } from "@/lib/auth-server";

type MessagePart = UIMessage["parts"][number];
export type SourceMessagePart = Extract<
  MessagePart,
  { type: "source-document" | "source-url" }
>;

export interface VerificationResult {
  claim: string;
  document_name: string | null;
  isSupported: boolean;
  matching_text: string | null;
  source?: SourceMatch | null;
}

interface SourceMatch {
  bbox?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  chunkId?: string;
  content: string;
  fileId: Id<"knowledgeBaseFiles">;
  filename: string;
  pageHeight?: number;
  pageNumber?: number;
  pageWidth?: number;
  segmentId?: string;
  sourceId: string;
}

const STREAM_ERROR_MESSAGE = "An unexpected error occurred. Please try again.";

const handleStreamError = (error: unknown) => {
  console.error(error);
  return STREAM_ERROR_MESSAGE;
};

type AnyStreamTextResult =
  ReturnType<typeof streamText> extends StreamTextResult<
    infer TOOLS,
    infer OUTPUT
  >
    ? StreamTextResult<TOOLS, OUTPUT>
    : never;

interface StreamAssistantResponseOptions {
  originalMessages: UIMessage[];
  result: AnyStreamTextResult;
  sourceParts?: readonly SourceMessagePart[];
  threadId: Id<"chatThreads">;
}

const persistAssistantMessage = async ({
  threadId,
  responseMessage,
  isAborted,
}: {
  isAborted: boolean;
  responseMessage: UIMessage;
  threadId: Id<"chatThreads">;
}) => {
  await fetchAuthAction(api.chat.messages.appendMessage, {
    threadId,
    role: "assistant",
    messageId: responseMessage.id,
    parts: responseMessage.parts,
    metadata: isAborted ? { aborted: true } : undefined,
  });
};

export const getMessageText = (message: UIMessage): string =>
  message.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text"
    )
    .map((part) => part.text)
    .join("")
    .trim();

export const getLastUserMessage = (
  messages: UIMessage[]
): UIMessage | undefined => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user") {
      return message;
    }
  }
  return undefined;
};

export const appendUserMessage = async (
  threadId: Id<"chatThreads">,
  message: UIMessage,
  chatFileIds: Id<"chatFiles">[]
) => {
  await fetchAuthAction(api.chat.messages.appendMessage, {
    threadId,
    role: "user",
    messageId: message.id,
    parts: message.parts,
    metadata: chatFileIds.length > 0 ? { chatFileIds } : undefined,
  });
};

export const streamAssistantResponse = ({
  threadId,
  originalMessages,
  sourceParts = [],
  result,
}: StreamAssistantResponseOptions) => {
  const onFinish = async ({
    responseMessage,
    isAborted,
  }: {
    isAborted: boolean;
    responseMessage: UIMessage;
  }) =>
    persistAssistantMessage({
      threadId,
      responseMessage,
      isAborted,
    });

  if (sourceParts.length === 0) {
    return result.toUIMessageStreamResponse({
      originalMessages,
      onFinish,
      onError: handleStreamError,
      consumeSseStream: consumeStream,
    });
  }

  const stream = createUIMessageStream<UIMessage>({
    execute: ({ writer }) => {
      for (const part of sourceParts) {
        writer.write(part);
      }
      writer.merge(
        result.toUIMessageStream({
          originalMessages,
        })
      );
    },
    originalMessages,
    onFinish,
    onError: handleStreamError,
  });

  return createUIMessageStreamResponse({
    stream,
    consumeSseStream: consumeStream,
  });
};

interface ExtractAndVerifyOptions {
  content: string;
  extractClaimsSystemPrompt: string;
  model: string;
  verifyClaimSystemPrompt: string;
}

export const extractAndVerify = async ({
  content,
  model,
  extractClaimsSystemPrompt,
  verifyClaimSystemPrompt,
}: ExtractAndVerifyOptions): Promise<VerificationResult[]> => {
  const verifySearchLimit = 12;
  const {
    output: { claims },
  } = await generateText({
    model,
    system: extractClaimsSystemPrompt,
    temperature: 0.1,
    messages: [{ role: "user", content }],
    output: Output.object({
      schema: z.object({ claims: z.array(z.string()) }),
    }),
  });

  console.log("[chat] claims", claims);

  if (claims.length === 0) {
    return [];
  }

  return await Promise.all(
    claims.map(async (claim) => {
      const context = await fetchAuthAction(
        api.knowledgeBase.kbActions.searchKnowledgeBase,
        { query: claim, limit: verifySearchLimit }
      );
      const sources: SourceMatch[] = context.map((item, index) => ({
        sourceId: `${item.fileId}:${item.segmentId ?? item.chunkId ?? index}`,
        fileId: item.fileId,
        filename: item.filename,
        content: item.content,
        chunkId: item.chunkId,
        segmentId: item.segmentId,
        pageNumber: item.pageNumber,
        pageWidth: item.pageWidth,
        pageHeight: item.pageHeight,
        bbox: item.bbox,
      }));
      const contextText = sources
        .map(
          (source) =>
            `source_id: ${source.sourceId}\nDocument: ${source.filename}\n${source.content}`
        )
        .join("\n\n");
      const { output: verdict } = await generateText({
        model,
        system: verifyClaimSystemPrompt,
        temperature: 0.1,
        prompt: `Claim: ${claim}\nContext: ${contextText}`,
        output: Output.object({
          schema: z.object({
            isSupported: z.boolean(),
            document_name: z.string().nullable(),
            matching_text: z.string().nullable(),
            source_id: z.string().nullable(),
          }),
        }),
      });
      const source =
        verdict.source_id === null
          ? null
          : (sources.find((item) => item.sourceId === verdict.source_id) ??
            null);
      return { claim, ...verdict, source };
    })
  );
};

export const toSourceParts = (
  verifications: VerificationResult[]
): SourceMessagePart[] =>
  verifications.flatMap((verification) => {
    const source = verification.source;
    if (!source) {
      return [];
    }
    return [
      {
        type: "source-document",
        sourceId: source.sourceId,
        mediaType: "application/pdf",
        title: source.filename,
        filename: source.filename,
        providerMetadata: {
          rag: {
            fileId: source.fileId,
            segmentId: source.segmentId,
            chunkId: source.chunkId,
            pageNumber: source.pageNumber,
            pageWidth: source.pageWidth,
            pageHeight: source.pageHeight,
            bbox: source.bbox,
            snippet: verification.matching_text,
          },
        },
      } satisfies SourceMessagePart,
    ];
  });
