import {
  consumeStream,
  generateText,
  Output,
  type streamText,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fetchAuthAction } from "@/lib/auth-server";

export interface VerificationResult {
  claim: string;
  document_name: string | null;
  isSupported: boolean;
  matching_text: string | null;
}

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

export const toPersistedAssistantResponse = (
  result: ReturnType<typeof streamText>,
  params: { threadId: Id<"chatThreads">; originalMessages: UIMessage[] }
) =>
  result.toUIMessageStreamResponse({
    consumeSseStream: consumeStream,
    sendReasoning: true,
    originalMessages: params.originalMessages,
    onFinish: async ({ responseMessage, isAborted }) => {
      await fetchAuthAction(api.chat.messages.appendMessage, {
        threadId: params.threadId,
        role: "assistant",
        messageId: responseMessage.id,
        parts: responseMessage.parts,
        metadata: isAborted ? { aborted: true } : undefined,
      });
    },
    onError: (error) => {
      console.error(error);
      return "An unexpected error occurred. Please try again.";
    },
  });

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
  const {
    output: { claims },
  } = await generateText({
    model,
    system: extractClaimsSystemPrompt,
    messages: [{ role: "user", content }],
    output: Output.object({
      schema: z.object({ claims: z.array(z.string()) }),
    }),
  });

  if (claims.length === 0) {
    return [];
  }

  return await Promise.all(
    claims.map(async (claim) => {
      const context = await fetchAuthAction(
        api.knowledgeBase.kbActions.searchKnowledgeBase,
        { query: claim, limit: 6 }
      );
      const contextText = context
        .map((item) => `Document: ${item.filename}\n${item.content}`)
        .join("\n\n");
      const { output: verdict } = await generateText({
        model,
        system: verifyClaimSystemPrompt,
        prompt: `Claim: ${claim}\nContext: ${contextText}`,
        output: Output.object({
          schema: z.object({
            isSupported: z.boolean(),
            document_name: z.string().nullable(),
            matching_text: z.string().nullable(),
          }),
        }),
      });
      return { claim, ...verdict };
    })
  );
};
