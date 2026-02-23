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
  streamAssistantResponse,
  toSourceParts,
  type VerificationResult,
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
  'Extract factual, checkable claims from the input text. Keep each claim self-contained with qualifiers (e.g., population, comparator, dosage, timeframe, units). Do not split a claim if splitting would drop context. Do not include opinions, questions, or instructions. Return JSON only: {"claims": string[]}.';
const VERIFY_CLAIM_SYSTEM_PROMPT =
  "Use only the provided context. Each context block starts with source_id and Document. If the claim is supported, set isSupported=true, choose the best matching source_id from the context, set document_name to that Document value, and set matching_text to a short verbatim excerpt from the context (<= 25 words). If not supported, set isSupported=false and all other fields to null. Return JSON only with keys: isSupported, document_name, matching_text, source_id.";
const REWRITE_DRAFT_SYSTEM_PROMPT =
  "Rewrite the draft to remove or correct unsupported claims while preserving intent and readability. Return plain text only.";
const FACT_CHECK_SUMMARY_SYSTEM_PROMPT =
  "Write a friendly, concise summary of fact-check results. Clearly separate supported and unsupported claims. For supported claims, include the document name and source_id in brackets, and quote a short matching_text excerpt when available. For unsupported claims, say what evidence is missing.";

const formatVerificationsForPrompt = (
  verifications: VerificationResult[]
): string =>
  verifications
    .map((verification, index) =>
      [
        `Claim ${index + 1}: ${verification.claim}`,
        `Supported: ${verification.isSupported ? "yes" : "no"}`,
        `Document: ${verification.document_name ?? "n/a"}`,
        `Source ID: ${verification.source?.sourceId ?? "n/a"}`,
        `Matching text: ${verification.matching_text ?? "n/a"}`,
      ].join("\n")
    )
    .join("\n\n");

interface ChatRequestBody {
  chatFileIds?: Id<"chatFiles">[];
  messages?: UIMessage[];
  threadId?: Id<"chatThreads">;
  trigger?: string;
}

export async function POST(req: Request) {
  const body: ChatRequestBody = await req.json();
  const requestMessages = body.messages ?? [];
  const threadId = body.threadId;
  const chatFileIds = body.chatFileIds ?? [];

  if (!threadId) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const thread = await fetchAuthQuery(api.chat.threads.getThread, { threadId });
  if (!thread) {
    return Response.json({ error: "THREAD_NOT_FOUND" }, { status: 404 });
  }

  const validated = await safeValidateUIMessages({
    messages: requestMessages,
  });
  if (!validated.success) {
    console.error("Chat request failed message validation.", validated.error);
    return Response.json({ error: "INVALID_MESSAGES" }, { status: 400 });
  }

  const messages = validated.data;
  const lastMessage = messages.at(-1);
  const lastUserMessage = getLastUserMessage(messages);
  const latestUserText = lastUserMessage ? getMessageText(lastUserMessage) : "";
  if (!(lastMessage && latestUserText)) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  if (
    lastMessage.role === "user" &&
    body.trigger !== "regenerate-message" &&
    lastMessage.parts.length > 0
  ) {
    await appendUserMessage(threadId, lastMessage, chatFileIds);
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
  console.log("[chat] route", route);

  if (route === "general_chat") {
    const modelMessages = await convertToModelMessages(messages);
    return streamAssistantResponse({
      result: streamText({
        model,
        system: GENERAL_CHAT_SYSTEM_PROMPT,
        messages: modelMessages,
        stopWhen: stepCountIs(MAX_TOOL_STEPS),
        abortSignal: req.signal,
      }),
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
    console.log("[chat] generated draft", generatedDraft);
    targetContent = text;
  }

  const verifications = await extractAndVerify({
    content: targetContent,
    model,
    extractClaimsSystemPrompt: EXTRACT_CLAIMS_SYSTEM_PROMPT,
    verifyClaimSystemPrompt: VERIFY_CLAIM_SYSTEM_PROMPT,
  });
  console.log("[chat] verifications", verifications);
  const failedClaims = verifications.filter(
    (verification) => !verification.isSupported
  );

  if (
    route === "generate_content" &&
    failedClaims.length > 0 &&
    generatedDraft
  ) {
    return streamAssistantResponse({
      result: streamText({
        model,
        system: REWRITE_DRAFT_SYSTEM_PROMPT,
        prompt: [
          "Original draft:",
          generatedDraft,
          "",
          "Unsupported claims:",
          formatVerificationsForPrompt(failedClaims),
        ].join("\n"),
        abortSignal: req.signal,
      }),
      threadId,
      originalMessages: messages,
    });
  }

  const sourceParts = toSourceParts(verifications);
  const summarySystemPrompt =
    route === "generate_content"
      ? `${FACT_CHECK_SUMMARY_SYSTEM_PROMPT} Include the approved draft at the end if available.`
      : FACT_CHECK_SUMMARY_SYSTEM_PROMPT;
  const summaryPrompt = [
    "Fact-check results:",
    formatVerificationsForPrompt(verifications),
    ...(route === "generate_content"
      ? ["", "Approved draft:", generatedDraft ?? ""]
      : []),
  ].join("\n");
  const summaryResult = streamText({
    model,
    system: summarySystemPrompt,
    prompt: summaryPrompt,
    abortSignal: req.signal,
  });

  return streamAssistantResponse({
    result: summaryResult,
    threadId,
    originalMessages: messages,
    sourceParts,
  });
}
