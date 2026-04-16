/**
 * Global Error Handler middleware — Express 4 error handler
 *
 * Must be registered LAST in the Express app (after all routes) via:
 *   app.use(errorHandler);
 *
 * Logs every error with:
 *  - requestId (from requestIdMiddleware)
 *  - HTTP method + path
 *  - Error message + full stack trace
 *  - OpenTelemetry traceId (automatically injected by Winston otelFormat)
 *
 * Never exposes internal stack traces to the client in production.
 *
 * Satisfies Maintainability: "Error Logging integrated into the observability stack
 * (all errors logged with context, stack trace, and request ID)"
 *
 * @module middleware/errorHandler
 */

import { Request, Response, NextFunction } from "express";
import { childLogger } from "../lib/logger.js";

const log = childLogger("ErrorHandler");

/** Shape of a structured API error response */
interface ApiErrorResponse {
  error: string;
  requestId: string;
  timestamp: string;
  path?: string;
}

/**
 * Express global error handler.
 * Signature must have 4 parameters for Express to recognise it as an error handler.
 */
export function errorHandler(
  err: Error & { status?: number; statusCode?: number; expose?: boolean },
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.status ?? err.statusCode ?? 500;
  const isDev = process.env.NODE_ENV !== "production";

  // ── Structured error log (picked up by Loki via stdout) ──────────────────────
  log.error(err.message, {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    statusCode,
    stack: err.stack,
    body: isDev ? req.body : "[redacted]",
  });

  // ── Response ──────────────────────────────────────────────────────────────────
  const body: ApiErrorResponse = {
    error:
      statusCode < 500 || isDev ? err.message : "Internal server error",
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  res.status(statusCode).json(body);
}

/**
 * 404 Not Found handler — register before errorHandler, after all routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  log.warn("Route not found", {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
  });

  res.status(404).json({
    error: `Route ${req.method} ${req.path} not found`,
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
}
