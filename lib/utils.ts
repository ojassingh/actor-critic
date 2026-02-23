import { type ClassValue, clsx } from "clsx";
import { formatDistanceStrict } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const formatRelativeTime = (
  timestampMs: number,
  nowMs: number = Date.now()
): string =>
  formatDistanceStrict(timestampMs, nowMs, {
    addSuffix: true,
    roundingMethod: "floor",
  });
