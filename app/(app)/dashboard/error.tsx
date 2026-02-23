"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { handleError } from "@/lib/handle-error";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    handleError(error);
  }, [error]);

  return (
    <main className="flex h-full items-center justify-center p-4">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <h2 className="font-medium text-lg">Something went wrong</h2>
        <p className="text-muted-foreground text-sm">
          We couldn&apos;t load this page. Please try again.
        </p>
        <Button onClick={reset} type="button" variant="outline">
          Try again
        </Button>
      </div>
    </main>
  );
}
