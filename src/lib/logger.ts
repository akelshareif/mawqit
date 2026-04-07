import { sanitizeLogMeta } from "@/lib/log-sanitize";

type LogLevel = "info" | "warn" | "error";

function format(
  level: LogLevel,
  context: string,
  message: string,
  meta?: Record<string, unknown>,
): string {
  const base = `[${context}] ${message}`;
  if (meta && Object.keys(meta).length > 0) {
    try {
      const safe = sanitizeLogMeta(meta) ?? meta;
      return `${base} ${JSON.stringify(safe)}`;
    } catch {
      return base;
    }
  }
  return base;
}

function write(level: LogLevel, context: string, message: string, meta?: Record<string, unknown>) {
  const line = format(level, context, message, meta);
  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      console.info(line);
  }
}

export const logger = {
  info(context: string, message: string, meta?: Record<string, unknown>) {
    write("info", context, message, meta);
  },
  warn(context: string, message: string, meta?: Record<string, unknown>) {
    write("warn", context, message, meta);
  },
  error(context: string, message: string, meta?: Record<string, unknown>) {
    write("error", context, message, meta);
  },
};
