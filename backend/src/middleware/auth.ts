/**
 * Authentication middleware
 */

import jwt from "jsonwebtoken";

export function verifyToken(token: string): string {
  const decoded = jwt.verify(
    token,
    process.env.JWT_SECRET || "secret"
  ) as any;
  return decoded.userId;
}

export function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const userId = verifyToken(token);
    req.userId = userId;
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired token" });
  }
}
