import { type ClassValue, clsx } from "clsx";
import { formatDistanceStrict } from "date-fns";
import isPlainObject from "lodash/isPlainObject";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  isPlainObject(value);

export const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

export const getNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

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
