/**
 * Winston structured logger with Loki transport for observability
 *
 * Every log line emitted by this logger is structured JSON and includes:
 * - timestamp (ISO 8601)
 * - level
 * - message
 * - service name
 * - traceId / spanId when inside an OpenTelemetry span
 *
 * @module logger
 */

import winston from "winston";
import { context, trace, isSpanContextValid } from "@opentelemetry/api";

const { combine, timestamp, json, colorize, simple } = winston.format;

/**
 * Custom format that injects OpenTelemetry trace context into every log line.
 * This links log entries to distributed traces in Jaeger/Tempo.
 */
const otelFormat = winston.format((info) => {
  const span = trace.getSpan(context.active());
  if (span) {
    const spanCtx = span.spanContext();
    if (isSpanContextValid(spanCtx)) {
      info["traceId"] = spanCtx.traceId;
      info["spanId"] = spanCtx.spanId;
    }
  }
  return info;
});

const transports: winston.transport[] = [
  // Always log to console (stdout — picked up by Docker/Loki)
  process.env.NODE_ENV === "production"
    ? new winston.transports.Console({ format: combine(otelFormat(), timestamp(), json()) })
    : new winston.transports.Console({
        format: combine(otelFormat(), colorize(), simple()),
      }),
];

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  defaultMeta: {
    service: process.env.SERVICE_NAME || "shipmind-backend",
    version: "2.0.0",
  },
  transports,
  // Do not exit on uncaught exceptions — let the process manager handle it
  exitOnError: false,
});

/**
 * Child logger factory — creates a logger scoped to a specific component
 *
 * @param component - Component name (e.g., "OrchestratorAgent", "AuthService")
 */
export function childLogger(component: string) {
  return logger.child({ component });
}

export default logger;
