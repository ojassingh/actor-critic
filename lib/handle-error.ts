import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { AppError, ERROR_MESSAGES, isAppErrorCode } from "@/lib/errors";
import { getString, isRecord } from "@/lib/utils";

const getStringProp = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  return getString(value[key]);
};

const getConvexErrorMessage = (data: unknown): string | undefined => {
  if (typeof data === "string") {
    return isAppErrorCode(data) ? ERROR_MESSAGES[data] : data;
  }

  const code = getStringProp(data, "code");
  if (code && isAppErrorCode(code)) {
    return ERROR_MESSAGES[code];
  }

  const message = getStringProp(data, "message");
  if (message && message.trim().length > 0) {
    return message;
  }

  return undefined;
};

export function handleError(error: unknown) {
  if (error instanceof ConvexError) {
    toast.error(
      getConvexErrorMessage(error.data) ?? "An unexpected error occurred"
    );
    return;
  }

  if (error instanceof AppError) {
    toast.error(error.message);
    return;
  }

  console.error(error);
  toast.error("Something went wrong");
}
