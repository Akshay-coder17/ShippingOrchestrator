/**
 * Authentication middleware — JWT verification + RBAC
 *
 * Validates the Bearer access token on every protected route.
 * Short-lived access tokens (15 min) — clients must use /auth/refresh
 * to obtain a new one using their refresh token cookie.
 *
 * @module middleware/auth
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { childLogger } from "../lib/logger.js";

const log = childLogger("AuthMiddleware");

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
  io?: any;
}

interface JWTPayload {
  userId: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Verify an access token and attach userId + role to the request.
 * Returns 401 if missing, 403 if invalid/expired.
 */
export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "No access token provided" });
    return;
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET || "shipmind-dev-secret-change-me"
    ) as JWTPayload;

    req.userId = payload.userId;
    req.userRole = payload.role;
    next();
  } catch (err) {
    log.warn("Token verification failed", {
      error: (err as Error).message,
      ip: req.ip,
      path: req.path,
    });
    res.status(403).json({ error: "Invalid or expired access token" });
  }
}

/**
 * RBAC middleware factory — restricts a route to specific roles.
 *
 * Usage:
 *   router.get('/admin/users', authenticateToken, requireRole('ADMIN'), handler)
 *
 * @param roles - One or more roles that are allowed
 */
export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    if (!roles.includes(req.userRole)) {
      log.warn("RBAC access denied", {
        userId: req.userId,
        userRole: req.userRole,
        requiredRoles: roles,
        path: req.path,
      });
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    next();
  };
}

/**
 * Extract userId from JWT without blocking the request (optional auth).
 * Used on routes that behave differently for authenticated vs anonymous users.
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (token) {
    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET || "shipmind-dev-secret-change-me"
      ) as JWTPayload;
      req.userId = payload.userId;
      req.userRole = payload.role;
    } catch {
      // Ignore invalid token in optional auth
    }
  }
  next();
}

// Legacy alias for backward compatibility
export const verifyToken = (token: string): string => {
  const payload = jwt.verify(
    token,
    process.env.JWT_SECRET || "shipmind-dev-secret-change-me"
  ) as JWTPayload;
  return payload.userId;
};
