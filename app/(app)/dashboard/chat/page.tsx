"use client";

import { useRouter } from "next/navigation";
import { ChatThread } from "@/app/(app)/dashboard/chat/components/chat-thread";

export default function Page() {
  const router = useRouter();

  return (
    <main className="flex h-screen flex-col">
      <ChatThread
        className="flex-1"
        emptyStateLayout="composerCenteredCardsBelow"
        emptyStateTitleClassName="text-3xl md:text-4xl"
        onThreadSelect={(selectedThreadId) =>
          router.push(`/dashboard/chat/${selectedThreadId}`)
        }
        suggestions="generic"
      />
    </main>
  );
}
