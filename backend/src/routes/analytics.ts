/**
 * Analytics Routes — properly structured with authenticateToken middleware
 * and Winston logger (no console.error, no raw JSON.parse on Prisma fields).
 *
 * Endpoints:
 *  GET /api/analytics/overview        — Dashboard KPI stats
 *  GET /api/analytics/rewards         — RL reward history
 *  GET /api/analytics/agent-report    — Per-agent performance
 *  GET /api/analytics/agent-qtable    — Current Q-table values (admin)
 *
 * @module routes/analytics
 */

import express, { Response } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticateToken, requireRole, AuthenticatedRequest } from "../middleware/auth.js";
import { RewardEngine } from "../rl/RewardEngine.js";
import { childLogger } from "../lib/logger.js";
import { trace } from "@opentelemetry/api";

const router = express.Router();
const log = childLogger("AnalyticsRoutes");
const tracer = trace.getTracer("shipmind-analytics");

// ─── GET /api/analytics/overview ─────────────────────────────────────────────
/**
 * High-level KPI stats for the dashboard.
 * Returns: totalShipments, userQueries, avgRating, activeRoutes, agentPerformance
 */
router.get("/overview", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const span = tracer.startSpan("analytics.overview");
  try {
    const userId = req.userId!;

    const [queries, shipments, agentRewards] = await Promise.all([
      prisma.query.findMany({ where: { userId } }),
      prisma.shipment.findMany({ where: { query: { userId } } }),
      prisma.agentReward.findMany({ where: { query: { userId } } }),
    ]);

    const ratedQueries = queries.filter((q) => q.rating !== null);
    const avgRating =
      ratedQueries.length > 0
        ? ratedQueries.reduce((s, q) => s + (q.rating ?? 0), 0) / ratedQueries.length
        : null;

    const agentStats: Record<string, { totalReward: number; count: number; avgReward: number }> = {};
    for (const ar of agentRewards) {
      if (!agentStats[ar.agentName]) {
        agentStats[ar.agentName] = { totalReward: 0, count: 0, avgReward: 0 };
      }
      agentStats[ar.agentName].totalReward += ar.reward;
      agentStats[ar.agentName].count++;
      agentStats[ar.agentName].avgReward =
        agentStats[ar.agentName].totalReward / agentStats[ar.agentName].count;
    }

    const activeRoutes = shipments.filter((s) => s.status === "in_transit").length;

    span.end();
    res.json({
      totalShipments: shipments.length,
      userQueries: queries.length,
      avgRating,
      activeRoutes,
      agentPerformance: agentStats,
    });
  } catch (error) {
    span.recordException(error as Error);
    span.end();
    log.error("Overview fetch failed", {
      error: (error as Error).message,
      stack: (error as Error).stack,
      userId: req.userId,
      requestId: (req as any).requestId,
    });
    res.status(500).json({ error: "Failed to fetch overview" });
  }
});

// ─── GET /api/analytics/rewards ──────────────────────────────────────────────
/**
 * RL reward history for the authenticated user's queries.
 */
router.get("/rewards", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rewards = await prisma.agentReward.findMany({
      where: { query: { userId: req.userId! } },
      orderBy: { timestamp: "desc" },
      take: 100,
    });

    res.json({
      rewards: rewards.map((r) => ({
        id: r.id,
        agentName: r.agentName,
        action: r.action,
        reward: r.reward,
        // factors is already a JSON object from Prisma — no JSON.parse needed
        factors: r.factors,
        timestamp: r.timestamp,
      })),
    });
  } catch (error) {
    log.error("Rewards fetch failed", {
      error: (error as Error).message,
      userId: req.userId,
      requestId: (req as any).requestId,
    });
    res.status(500).json({ error: "Failed to fetch rewards" });
  }
});

// ─── GET /api/analytics/agent-report ─────────────────────────────────────────
/**
 * Detailed per-agent performance report (last 30 days).
 * Query param: ?agentName=RouteOptimizer (optional — returns all if omitted)
 */
router.get("/agent-report", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { agentName, days } = req.query;
    const lookback = parseInt(days as string || "30");

    if (agentName) {
      // Single-agent detail
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - lookback);

      const rewards = await prisma.agentReward.findMany({
        where: {
          agentName: agentName as string,
          query: { userId: req.userId! },
          timestamp: { gte: cutoff },
        },
        orderBy: { timestamp: "desc" },
      });

      const totalReward = rewards.reduce((s, r) => s + r.reward, 0);
      const avgReward = rewards.length > 0 ? totalReward / rewards.length : 0;

      res.json({
        agentName,
        totalActions: rewards.length,
        totalReward,
        avgReward,
        recentActions: rewards.slice(0, 20).map((r) => ({
          action: r.action,
          reward: r.reward,
          factors: r.factors,
          timestamp: r.timestamp,
        })),
      });
    } else {
      // All-agents report
      const report = await RewardEngine.generateAgentReport(lookback);
      res.json({ agents: report, lookbackDays: lookback });
    }
  } catch (error) {
    log.error("Agent report fetch failed", {
      error: (error as Error).message,
      userId: req.userId,
    });
    res.status(500).json({ error: "Failed to fetch agent report" });
  }
});

// ─── GET /api/analytics/agent-qtable ─────────────────────────────────────────
/**
 * Returns current Q-table values (ADMIN only) — shows Meta-RL state.
 */
router.get(
  "/agent-qtable",
  authenticateToken,
  requireRole("ADMIN"),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const qtable = await prisma.agentQTable.findMany({
        orderBy: { agentName: "asc" },
      });
      res.json({ qtable });
    } catch (error) {
      log.error("Q-table fetch failed", { error: (error as Error).message });
      res.status(500).json({ error: "Failed to fetch Q-table" });
    }
  }
);

export default router;
