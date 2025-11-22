import dotenv from "dotenv";
import pino from "pino";

// Only load if not already loaded (check if a key env var exists)
if (!process.env.OPENAI_API_KEY) {
  dotenv.config();
}

const logLevel = process.env.LOG_LEVEL || "error";
const logFormat = process.env.LOG_FORMAT?.toLowerCase() || "auto";

const useTextFormat =
  logFormat === "text" ||
  (logFormat === "auto" && process.env.NODE_ENV === "development");

export const logger = pino({
  level: logLevel,
  ...(useTextFormat && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
        translateTime: "HH:MM:ss",
        messageFormat: "{msg}",
      },
    },
  }),
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Generate a correlation ID for request tracking
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
