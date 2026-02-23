import {
  convertToModelMessages,
  generateText,
  Output,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fetchAuthQuery } from "@/lib/auth-server";
import {
  appendUserMessage,
  extractAndVerify,
  getLastUserMessage,
  getMessageText,
  toPersistedAssistantResponse,
} from "./helpers";

const model = "xai/grok-4.1-fast-reasoning";
const MAX_TOOL_STEPS = 5;
const ROUTE_SYSTEM_PROMPT = `
Classify the user message into one route:
- "general_chat": normal Q&A/help
- "fact_check_input": user wants factual verification
- "generate_content": user wants you to draft content

Return JSON only with this shape: {"route":"general_chat" | "fact_check_input" | "generate_content"}.
`.trim();

const GENERAL_CHAT_SYSTEM_PROMPT =
  "You are a helpful assistant. Give direct, concise, accurate answers.";
const GENERATE_CONTENT_SYSTEM_PROMPT =
  "Generate clear, concise marketing copy based on the user's request. Avoid unsupported factual claims.";
const EXTRACT_CLAIMS_SYSTEM_PROMPT =
  'Extract factual, checkable claims from the input text. Return JSON only: {"claims": string[]}.';
const VERIFY_CLAIM_SYSTEM_PROMPT =
  "Check whether the claim is supported by the provided context. Return JSON only with keys: isSupported, document_name, matching_text.";
const REWRITE_DRAFT_SYSTEM_PROMPT =
  "Rewrite the draft to remove or correct unsupported claims while preserving intent and readability. Return plain text only.";
const FACT_CHECK_SUMMARY_SYSTEM_PROMPT =
  "Write a friendly, concise summary of fact-check results. Clearly separate supported and unsupported claims.";

interface ChatRequestBody {
  chatFileIds?: Id<"chatFiles">[];
  messageId?: string;
  messages?: UIMessage[];
  threadId?: Id<"chatThreads">;
  trigger?: string;
}

export async function POST(req: Request) {
  const body: ChatRequestBody = await req.json();
  const rawMessages = body.messages ?? [];
  const threadId = body.threadId;
  const chatFileIds = body.chatFileIds ?? [];

  if (!threadId || rawMessages.length === 0) {
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
  const lastMessage = messages.at(-1);
  if (!lastMessage) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  if (
    lastMessage.role === "user" &&
    body.trigger !== "regenerate-message" &&
    lastMessage.parts.length > 0
  ) {
    await appendUserMessage(threadId, lastMessage, chatFileIds);
  }

  const lastUserMessage = getLastUserMessage(messages);
  const latestUserText = lastUserMessage ? getMessageText(lastUserMessage) : "";
  if (!latestUserText) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const {
    output: { route },
  } = await generateText({
    model,
    system: ROUTE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: latestUserText }],
    output: Output.object({
      schema: z.object({
        route: z.enum(["general_chat", "fact_check_input", "generate_content"]),
      }),
    }),
  });

  const modelMessages = await convertToModelMessages(messages);

  if (route === "general_chat") {
    const result = streamText({
      model,
      system: GENERAL_CHAT_SYSTEM_PROMPT,
      messages: modelMessages,
      stopWhen: stepCountIs(MAX_TOOL_STEPS),
      abortSignal: req.signal,
    });
    console.log("[chat] Returning general chat stream");
    return toPersistedAssistantResponse(result, {
      threadId,
      originalMessages: messages,
    });
  }

  let targetContent = latestUserText;
  let generatedDraft: string | null = null;

  if (route === "generate_content") {
    const { text } = await generateText({
      model,
      system: GENERATE_CONTENT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: latestUserText }],
    });
    generatedDraft = text;
    targetContent = text;
  }

  const verifications = await extractAndVerify({
    content: targetContent,
    model,
    extractClaimsSystemPrompt: EXTRACT_CLAIMS_SYSTEM_PROMPT,
    verifyClaimSystemPrompt: VERIFY_CLAIM_SYSTEM_PROMPT,
  });
  const failedClaims = verifications.filter(
    (verification) => !verification.isSupported
  );

  if (
    route === "generate_content" &&
    failedClaims.length > 0 &&
    generatedDraft
  ) {
    const rewriteResult = streamText({
      model,
      system: REWRITE_DRAFT_SYSTEM_PROMPT,
      prompt: [
        "Original draft:",
        generatedDraft,
        "",
        "Unsupported claims:",
        JSON.stringify(failedClaims, null, 2),
      ].join("\n"),
      abortSignal: req.signal,
    });
    console.log("[chat] Returning auto-corrected stream");
    return toPersistedAssistantResponse(rewriteResult, {
      threadId,
      originalMessages: messages,
    });
  }

  const summaryResult = streamText({
    model,
    system:
      route === "generate_content"
        ? `${FACT_CHECK_SUMMARY_SYSTEM_PROMPT} Include the approved draft at the end if available.`
        : FACT_CHECK_SUMMARY_SYSTEM_PROMPT,
    prompt: [
      "Fact-check results:",
      JSON.stringify(verifications, null, 2),
      ...(route === "generate_content"
        ? ["", "Approved draft:", generatedDraft ?? ""]
        : []),
    ].join("\n"),
    abortSignal: req.signal,
  });

  console.log("[chat] Returning fact-check summary stream");
  return toPersistedAssistantResponse(summaryResult, {
    threadId,
    originalMessages: messages,
  });
}
