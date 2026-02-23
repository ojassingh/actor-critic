export const ERROR_MESSAGES = {
  AUTH_UNAUTHORIZED: "You must be signed in to do this",
  AUTH_SESSION_EXPIRED: "Your session has expired",
  FORBIDDEN: "You do not have permission to access this resource",
  FILE_NOT_FOUND: "File not found",
  FILE_TOO_LARGE: "File is too large. Maximum size is 5 MB",
  UNSUPPORTED_CONTENT_TYPE: "Unsupported file type. Upload a PDF or image",
  THREAD_NOT_FOUND: "Chat thread not found",
  OCR_CONFIG_ERROR: "OCR configuration error",
  OCR_INVALID_RESPONSE: "Invalid response from AI service",
  INVALID_REQUEST: "Invalid request",
  INVALID_MESSAGES: "Invalid chat message payload",
  INTERNAL_ERROR: "Something went wrong",
} as const;

export type AppErrorCode = keyof typeof ERROR_MESSAGES;

export const isAppErrorCode = (value: string): value is AppErrorCode =>
  value in ERROR_MESSAGES;

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, messageOverride?: string) {
    super(messageOverride || ERROR_MESSAGES[code]);
    this.code = code;
    this.name = "AppError";
  }

  static Auth = {
    Unauthorized: () => new AppError("AUTH_UNAUTHORIZED"),
    SessionExpired: () => new AppError("AUTH_SESSION_EXPIRED"),
  };

  static Ocr = {
    ConfigError: () => new AppError("OCR_CONFIG_ERROR"),
    InvalidResponse: () => new AppError("OCR_INVALID_RESPONSE"),
  };

  static General = {
    InvalidRequest: (msg?: string) => new AppError("INVALID_REQUEST", msg),
    InternalError: (msg?: string) => new AppError("INTERNAL_ERROR", msg),
  };
}
