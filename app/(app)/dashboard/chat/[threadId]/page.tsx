"use client";

import { useParams, useRouter } from "next/navigation";
import { ChatThread } from "@/app/(app)/dashboard/chat/components/chat-thread";
import type { ChatThreadId } from "@/lib/types/chat";

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const threadId = params.threadId;

  if (typeof threadId !== "string") {
    return null;
  }

  const chatThreadId = threadId as ChatThreadId;

  return (
    <main className="flex h-screen flex-col">
      <ChatThread
        className="flex-1"
        onNavigateToLanding={() => router.push("/dashboard/chat")}
        onThreadSelect={(selectedThreadId) =>
          router.push(`/dashboard/chat/${selectedThreadId}`)
        }
        suggestions="generic"
        threadId={chatThreadId}
      />
    </main>
  );
}
