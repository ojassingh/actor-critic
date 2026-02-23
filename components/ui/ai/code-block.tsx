"use client";

import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type React from "react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type CodeBlockProps = {
  children?: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <div
      className={cn(
        "not-prose my-4 flex w-full min-w-0 max-w-full flex-col overflow-clip border",
        "rounded-xl border-border bg-card text-card-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type CodeBlockCodeProps = {
  code: string;
  language?: string;
  theme?: string;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeBlockCode({
  code,
  language = "tsx",
  theme = "github-light",
  className,
  ...props
}: CodeBlockCodeProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, 1200);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  const handleCopy = async () => {
    if (!code) {
      return;
    }
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setCopied(false);
      return;
    }
    if (!document.hasFocus()) {
      setCopied(false);
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const classNames = cn(
    "w-full min-w-0 overflow-hidden text-[13px] [&>pre]:whitespace-pre-wrap [&>pre]:break-words [&>pre]:px-4 [&>pre]:py-4",
    className
  );

  return (
    <div className={classNames} {...props}>
      <div className="flex items-center justify-end border-border border-b px-2 py-2">
        <button
          aria-label={copied ? "Copied" : "Copy code"}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs",
            "text-muted-foreground transition-colors hover:text-foreground"
          )}
          onClick={handleCopy}
          type="button"
        >
          <AnimatePresence initial={false} mode="wait">
            {copied ? (
              <motion.span
                animate={{ opacity: 1, filter: "blur(0px)" }}
                className="inline-flex items-center gap-1"
                exit={{ opacity: 0, filter: "blur(6px)" }}
                initial={{ opacity: 0, filter: "blur(6px)" }}
                key="copied"
                transition={{ duration: 0.1 }}
              >
                <Check className="size-3.5" />
              </motion.span>
            ) : (
              <motion.span
                animate={{ opacity: 1, filter: "blur(0px)" }}
                className="inline-flex items-center gap-1"
                exit={{ opacity: 0, filter: "blur(6px)" }}
                initial={{ opacity: 0, filter: "blur(6px)" }}
                key="copy"
                transition={{ duration: 0.1 }}
              >
                <Copy className="size-3.5" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
      <pre data-language={language} data-theme={theme}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export type CodeBlockGroupProps = React.HTMLAttributes<HTMLDivElement>;

function CodeBlockGroup({
  children,
  className,
  ...props
}: CodeBlockGroupProps) {
  return (
    <div
      className={cn("flex items-center justify-between", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { CodeBlockGroup, CodeBlockCode, CodeBlock };
