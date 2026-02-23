"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "color-mix(in oklch, var(--popover) 60%, transparent)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border":
            "color-mix(in oklch, var(--border) 45%, transparent)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      theme={theme as ToasterProps["theme"]}
      toastOptions={{
        className: "backdrop-blur-sm text-foreground",
        style: {
          background: "color-mix(in oklch, var(--popover) 60%, transparent)",
          borderColor: "color-mix(in oklch, var(--border) 45%, transparent)",
          boxShadow:
            "0 0 0 1px color-mix(in oklch, var(--border) 45%, transparent), 0 12px 32px rgba(0, 0, 0, 0.2)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
