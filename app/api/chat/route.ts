import {
  consumeStream,
  convertToModelMessages,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fetchAuthAction, fetchAuthQuery } from "@/lib/auth-server";
import { buildAgentInstructions } from "@/lib/chat/agent-instructions";

export const maxDuration = 30;
const MAX_TOOL_STEPS = 5;
const PDF_CONTENT_TYPE = "application/pdf";

const loadAttachments = async (chatFileIds: Id<"chatFiles">[]) => {
  const files =
    chatFileIds.length > 0
      ? await fetchAuthQuery(api.chat.files.getFilesForChat, { chatFileIds })
      : [];

  const pdfContext = files
    .filter((file) => file.contentType === PDF_CONTENT_TYPE)
    .map((file) =>
      file.markdown ? `File: ${file.filename}\n\n${file.markdown}` : null
    )
    .filter((value): value is string => Boolean(value))
    .join("\n\n");

  const attachmentNotice =
    files.length > 0
      ? [
          "Attached files:",
          ...files.map(
            (file) =>
              `- ${file.filename}${
                file.contentType ? ` (${file.contentType})` : ""
              }`
          ),
        ].join("\n")
      : "";

  return { pdfContext, attachmentNotice };
};

const stripFileParts = (parts: UIMessage["parts"]) =>
  parts.filter((part) => {
    if (typeof part !== "object" || part === null) {
      return true;
    }
    const partType = (part as { type?: unknown }).type;
    if (partType === "file") {
      return false;
    }
    return true;
  });

const appendUserMessage = async (
  threadId: Id<"chatThreads">,
  lastMessage: UIMessage,
  chatFileIds: Id<"chatFiles">[]
): Promise<Response | null> => {
  try {
    await fetchAuthAction(api.chat.messages.appendMessage, {
      threadId,
      role: "user",
      messageId: lastMessage.id,
      parts: stripFileParts(lastMessage.parts),
      metadata: chatFileIds.length > 0 ? { chatFileIds } : undefined,
    });
  } catch (error) {
    console.error(error);
  }

  return null;
};

export async function POST(req: Request) {
  const body: {
    messages?: UIMessage[];
    threadId?: Id<"chatThreads">;
    chatFileIds?: Id<"chatFiles">[];
  } = await req.json();

  const rawMessages = body.messages ?? [];
  const threadId = body.threadId;
  const chatFileIds = body.chatFileIds ?? [];

  if (!threadId || rawMessages.length === 0) {
    console.error("Chat request missing threadId or messages.");
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const thread = await fetchAuthQuery(api.chat.threads.getThread, { threadId });
  if (!thread) {
    return Response.json({ error: "THREAD_NOT_FOUND" }, { status: 404 });
  }

  const sanitizedMessages = rawMessages.filter(
    (message) => Array.isArray(message.parts) && message.parts.length > 0
  );
  const validated = await safeValidateUIMessages({
    messages: sanitizedMessages,
  });
  if (!validated.success) {
    console.error("Chat request failed message validation.", validated.error);
    return Response.json({ error: "INVALID_MESSAGES" }, { status: 400 });
  }
  const messages = validated.data;
  const messagesWithoutFileParts = messages.map((message) => ({
    ...message,
    parts: stripFileParts(message.parts),
  }));

  const { pdfContext, attachmentNotice } =
    await loadAttachments(chatFileIds);

  const lastMessage = messagesWithoutFileParts.at(-1);
  if (!lastMessage) {
    console.error("Chat request contained no valid messages.");
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  const messagesForModel: UIMessage[] = messagesWithoutFileParts;

  if (lastMessage.role === "user") {
    const errorResponse = await appendUserMessage(
      threadId,
      lastMessage,
      chatFileIds
    );
    if (errorResponse) {
      return errorResponse;
    }
  }
  const instructions = buildAgentInstructions();
  const modelMessages = await convertToModelMessages(messagesForModel, {});
  const systemPrompt = [instructions, pdfContext, attachmentNotice]
    .filter(Boolean)
    .join("\n\n");

  const result = streamText({
    model: "xai/grok-4.1-fast-reasoning",
    system: systemPrompt,
    messages: modelMessages,
    stopWhen: stepCountIs(MAX_TOOL_STEPS),
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse({
    consumeSseStream: consumeStream,
    sendReasoning: true,
    originalMessages: messagesWithoutFileParts,
    onFinish: async ({ responseMessage, isAborted }) => {
      await fetchAuthAction(api.chat.messages.appendMessage, {
        threadId,
        role: "assistant",
        messageId: responseMessage.id,
        parts: stripFileParts(responseMessage.parts),
        metadata: isAborted ? { aborted: true } : undefined,
      });
    },
    onError: (error) => {
      console.error(error);
      return "An unexpected error occurred. Please try again.";
    },
  });
}
