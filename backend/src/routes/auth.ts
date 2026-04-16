/**
 * Authentication routes — register, login, Google OAuth, refresh tokens, MFA
 *
 * All PII fields (email) are NEVER returned in full in any response.
 * Only safe fields: id, name, role, emailVerified.
 *
 * @module routes/auth
 */

import express, { Request, Response } from "express";
import bcryptjs from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth.js";
import {
  generateAccessToken,
  generateRefreshToken,
  rotateRefreshToken,
  sendOTP,
  verifyOTP,
  findOrCreateGoogleUser,
} from "../services/AuthService.js";
import { childLogger } from "../lib/logger.js";
import { trace } from "@opentelemetry/api";

const log = childLogger("AuthRoutes");
const tracer = trace.getTracer("shipmind-auth");
const router = express.Router();

// ─── Safe user projection — NEVER expose passwordHash, mfaSecret, googleId ──
const SAFE_USER_SELECT = {
  id: true,
  name: true,
  // email is a PII field — we return it masked so frontend can show hint
  email: true,
  role: true,
  emailVerified: true,
  mfaEnabled: true,
  createdAt: true,
} as const;

/** Mask email PII for API responses — show "u***@domain.com" */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local[0]}***@${domain}`;
}

// ─── Configure Google OAuth Passport strategy ─────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3001/api/auth/google/callback",
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const { user } = await findOrCreateGoogleUser(profile as any);
          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
  log.info("Google OAuth strategy configured");
} else {
  log.warn("Google OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
}

router.use(passport.initialize());

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post("/register", async (req: Request, res: Response) => {
  const span = tracer.startSpan("auth.register");
  try {
    const { name, email, password } = req.body;

    if (!email || !password || !name) {
      span.end();
      return res.status(400).json({ error: "name, email and password are required" });
    }

    if (password.length < 8) {
      span.end();
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      span.end();
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcryptjs.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: "USER" },
      select: SAFE_USER_SELECT,
    });

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = await generateRefreshToken(
      user.id,
      req.ip,
      req.headers["user-agent"]
    );

    log.info("User registered", { userId: user.id });
    span.end();

    res
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .status(201)
      .json({
        user: { ...user, email: maskEmail(user.email) },
        accessToken,
      });
  } catch (error) {
    span.recordException(error as Error);
    span.end();
    log.error("Register error", { error: (error as Error).message });
    res.status(500).json({ error: "Registration failed" });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/login", async (req: Request, res: Response) => {
  const span = tracer.startSpan("auth.login");
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      span.end();
      return res.status(400).json({ error: "Email and password required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      span.end();
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcryptjs.compare(password, user.passwordHash);
    if (!valid) {
      log.warn("Failed login attempt", { email: maskEmail(email), ip: req.ip });
      span.end();
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // If MFA is enabled, require OTP verification before issuing tokens
    if (user.mfaEnabled) {
      await sendOTP(user.id, user.email);
      span.end();
      return res.status(200).json({
        mfaRequired: true,
        userId: user.id,
        message: "OTP sent to your email",
      });
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = await generateRefreshToken(
      user.id,
      req.ip,
      req.headers["user-agent"]
    );

    log.info("User logged in", { userId: user.id });
    span.end();

    res
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({
        user: {
          id: user.id,
          name: user.name,
          email: maskEmail(user.email),
          role: user.role,
          emailVerified: user.emailVerified,
          mfaEnabled: user.mfaEnabled,
        },
        accessToken,
      });
  } catch (error) {
    span.recordException(error as Error);
    span.end();
    log.error("Login error", { error: (error as Error).message });
    res.status(500).json({ error: "Login failed" });
  }
});

// ─── POST /api/auth/mfa/send ──────────────────────────────────────────────────
router.post("/mfa/send", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    await sendOTP(user.id, user.email);
    res.json({ message: "OTP sent" });
  } catch (error) {
    log.error("MFA send error", { error: (error as Error).message });
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// ─── POST /api/auth/mfa/verify ────────────────────────────────────────────────
router.post("/mfa/verify", async (req: Request, res: Response) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp) {
      return res.status(400).json({ error: "userId and otp required" });
    }

    const valid = await verifyOTP(userId, otp);
    if (!valid) {
      return res.status(401).json({ error: "Invalid or expired OTP" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: SAFE_USER_SELECT,
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = await generateRefreshToken(
      user.id,
      req.ip,
      req.headers["user-agent"]
    );

    log.info("MFA verified — tokens issued", { userId });

    res
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({
        user: { ...user, email: maskEmail(user.email) },
        accessToken,
      });
  } catch (error) {
    log.error("MFA verify error", { error: (error as Error).message });
    res.status(500).json({ error: "MFA verification failed" });
  }
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const rawToken = req.cookies?.refreshToken;
    if (!rawToken) {
      return res.status(401).json({ error: "No refresh token" });
    }

    const { accessToken, refreshToken, userId } = await rotateRefreshToken(
      rawToken,
      req.ip,
      req.headers["user-agent"]
    );

    log.info("Refresh token rotated", { userId });

    res
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({ accessToken });
  } catch (error) {
    log.warn("Refresh token invalid", { error: (error as Error).message });
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post("/logout", async (req: Request, res: Response) => {
  res.clearCookie("refreshToken").json({ message: "Logged out" });
});

// ─── GET /api/auth/google ─────────────────────────────────────────────────────
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

// ─── GET /api/auth/google/callback ───────────────────────────────────────────
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/auth/login?error=oauth" }),
  async (req: any, res: Response) => {
    try {
      const user = req.user as { id: string; name: string; email: string; role: string };
      const accessToken = generateAccessToken(user.id, user.role);
      const refreshToken = await generateRefreshToken(user.id, req.ip, req.headers["user-agent"]);

      log.info("Google OAuth login success", { userId: user.id });

      // Redirect to frontend with access token in URL (frontend stores it)
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      res
        .cookie("refreshToken", refreshToken, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: 7 * 24 * 60 * 60 * 1000,
        })
        .redirect(
          `${frontendUrl}/auth/callback?token=${accessToken}&name=${encodeURIComponent(user.name)}&role=${user.role}`
        );
    } catch (error) {
      log.error("Google callback error", { error: (error as Error).message });
      res.redirect("/auth/login?error=oauth_failed");
    }
  }
);

// ─── GET /api/auth/profile ────────────────────────────────────────────────────
router.get("/profile", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: SAFE_USER_SELECT,
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    // Return masked email — never expose full PII in API response
    res.json({ ...user, email: maskEmail(user.email) });
  } catch (error) {
    log.error("Profile error", { error: (error as Error).message });
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// ─── PUT /api/auth/mfa/enable ────────────────────────────────────────────────
router.put("/mfa/enable", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { mfaEnabled: true },
    });
    res.json({ message: "MFA enabled" });
  } catch (error) {
    res.status(500).json({ error: "Failed to enable MFA" });
  }
});

export default router;
