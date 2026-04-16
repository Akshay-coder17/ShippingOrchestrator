/**
 * AuthService — Google OAuth, JWT access/refresh token management, MFA via OTP
 *
 * Security design:
 * - Access tokens: 15-minute JWT signed HS256
 * - Refresh tokens: 7-day random hex token, bcrypt-hashed in DB
 * - OTP: 6-digit code, valid for 10 minutes, stored hashed in Redis
 * - PII: email stored directly (unique key), sensitive fields via CryptoService
 *
 * Uses Prisma singleton (lib/prisma.ts) and Redis singleton (lib/redis.ts)
 * to avoid connection pool exhaustion.
 *
 * @module services/AuthService
 */

import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import { randomBytes } from "node:crypto";
import { createTransport } from "nodemailer";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { childLogger } from "../lib/logger.js";

const log = childLogger("AuthService");

// ─── Nodemailer transport (Resend SMTP or Ethereal for hackathon) ─────────────
const mailer = createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: parseInt(process.env.SMTP_PORT || "587"),
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

// ─── Token helpers ────────────────────────────────────────────────────────────

const JWT_SECRET = () => process.env.JWT_SECRET || "shipmind-dev-secret-change-me";
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

/**
 * Generate a signed JWT access token (short-lived, 15 min)
 */
export function generateAccessToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET(), {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: "shipmind",
  });
}

/**
 * Generate a random refresh token and store its bcrypt hash in the database.
 *
 * @returns raw token (returned to client once, never stored in plain)
 */
export async function generateRefreshToken(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  const rawToken = randomBytes(64).toString("hex");
  const tokenHash = await bcryptjs.hash(rawToken, 10);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt, ipAddress, userAgent },
  });

  return rawToken;
}

/**
 * Validate a refresh token against stored hashes and rotate on success.
 *
 * @returns new access + refresh token pair if valid, throws otherwise
 */
export async function rotateRefreshToken(
  rawToken: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  // Find all non-expired tokens and test each (n is small per user)
  const tokens = await prisma.refreshToken.findMany({
    where: { expiresAt: { gt: new Date() } },
    include: { user: { select: { id: true, role: true } } },
  });

  let matched: (typeof tokens)[0] | undefined;
  for (const t of tokens) {
    if (await bcryptjs.compare(rawToken, t.tokenHash)) {
      matched = t;
      break;
    }
  }

  if (!matched) {
    throw new Error("Invalid or expired refresh token");
  }

  // Delete old token (rotation — prevents replay)
  await prisma.refreshToken.delete({ where: { id: matched.id } });

  // Issue new pair
  const newAccess = generateAccessToken(matched.userId, matched.user.role);
  const newRefresh = await generateRefreshToken(matched.userId, ipAddress, userAgent);

  return { accessToken: newAccess, refreshToken: newRefresh, userId: matched.userId };
}

// ─── MFA / OTP ────────────────────────────────────────────────────────────────

const OTP_EXPIRY_SECONDS = 600; // 10 minutes

/**
 * Generate and send a 6-digit OTP to the user's email.
 * OTP is bcrypt-hashed and stored in Redis with TTL.
 */
export async function sendOTP(userId: string, email: string): Promise<void> {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const key = `otp:${userId}`;

  const hashedOTP = await bcryptjs.hash(otp, 8);
  await redis.set(key, hashedOTP, { EX: OTP_EXPIRY_SECONDS });

  log.info("OTP generated and stored in Redis", {
    userId,
    email: email.split("@")[0] + "@***",
  });

  // Dev mode: log OTP to console for easy testing
  if (process.env.NODE_ENV !== "production") {
    log.warn(`[DEV] OTP for userId=${userId}: ${otp}`);
  }

  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || "noreply@shipmind.ai",
      to: email,
      subject: "ShipMind — Your One-Time Password",
      html: `
        <div style="font-family:sans-serif;max-width:420px;margin:0 auto;background:#0a0a1a;color:#fff;padding:32px;border-radius:12px">
          <h2 style="color:#00d4ff;margin:0 0 16px">🚀 ShipMind</h2>
          <p style="margin:0 0 24px;color:#aaa">Your one-time password for authentication:</p>
          <div style="letter-spacing:8px;font-size:36px;font-weight:700;color:#0a0a1a;background:#00d4ff;padding:20px;border-radius:8px;text-align:center;font-family:monospace">${otp}</div>
          <p style="margin:24px 0 0;color:#555;font-size:12px">Valid for 10 minutes. Never share this code with anyone.</p>
        </div>
      `,
    });
  } catch (emailErr) {
    log.warn("Email send failed — OTP logged above (dev mode)", {
      error: (emailErr as Error).message,
    });
  }
}

/**
 * Verify a submitted OTP for a user.
 * One-time use — deleted from Redis on success.
 */
export async function verifyOTP(userId: string, submittedOTP: string): Promise<boolean> {
  const key = `otp:${userId}`;
  const stored = await redis.get(key);

  if (!stored) {
    log.warn("OTP expired or not found", { userId });
    return false;
  }

  const valid = await bcryptjs.compare(submittedOTP, stored);
  if (valid) {
    await redis.del(key); // One-time use
    log.info("OTP verified successfully", { userId });
  } else {
    log.warn("OTP verification failed", { userId });
  }

  return valid;
}

// ─── Google OAuth ──────────────────────────────────────────────────────────────

export interface GoogleProfile {
  id: string;
  displayName: string;
  emails: Array<{ value: string; verified: boolean }>;
}

/**
 * Find or create a user from a Google OAuth profile.
 * Merges Google ID into an existing account if email matches.
 */
export async function findOrCreateGoogleUser(
  profile: GoogleProfile
): Promise<{ user: { id: string; name: string; email: string; role: string }; isNew: boolean }> {
  const email = profile.emails[0]?.value;
  if (!email) throw new Error("Google profile has no email");

  let user = await prisma.user.findUnique({ where: { googleId: profile.id } });
  let isNew = false;

  if (!user) {
    user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Merge Google ID into existing local account
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.id, emailVerified: true },
      });
    } else {
      user = await prisma.user.create({
        data: {
          name: profile.displayName,
          email,
          googleId: profile.id,
          emailVerified: true,
          role: "USER",
        },
      });
      isNew = true;
      log.info("New user created via Google OAuth", { userId: user.id });
    }
  }

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    isNew,
  };
}
