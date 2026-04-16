/**
 * requestId middleware — attaches a unique UUID to every incoming request
 *
 * The requestId is:
 *  - Added to the response header (X-Request-ID) for client-side correlation
 *  - Attached to `req.requestId` for use in route handlers and error logging
 *  - Injected into Winston log lines via `logger.child({ requestId })`
 *
 * Satisfies Maintainability: "all errors logged with context, stack trace, and request ID"
 *
 * @module middleware/requestId
 */

import { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

/** Extends Express Request with requestId */
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Assigns a UUID to every request and exposes it via header + req.requestId
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Honour upstream ID if provided (e.g., from an API gateway or load balancer)
  const requestId =
    (req.headers["x-request-id"] as string) || randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
}
