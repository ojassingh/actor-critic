"use client";

import { Card, CardContent } from "@/components/ui/card";

interface ChatSuggestionCardProps {
  onSelect: (prompt: string) => void;
  prompt: string;
}

export function ChatSuggestionCard({
  prompt,
  onSelect,
}: ChatSuggestionCardProps) {
  return (
    <Card
      className="group cursor-pointer gap-0 rounded-xl p-3 transition-colors duration-100 hover:shadow-md hover:ring-primary"
      onClick={() => onSelect(prompt)}
      role="button"
      tabIndex={0}
    >
      <CardContent className="p-0">
        <p className="text-sm">{prompt}</p>
      </CardContent>
    </Card>
  );
}
