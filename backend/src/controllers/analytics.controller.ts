/**
 * Analytics Controller — business logic for RL reward history and agent performance
 *
 * Extracted from routes/analytics.ts to follow MVC pattern.
 *
 * @module controllers/analytics.controller
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { RewardEngine } from "../rl/RewardEngine.js";
import { childLogger } from "../lib/logger.js";

const log = childLogger("AnalyticsController");

// ── GET /api/analytics/overview ──────────────────────────────────────────────

export async function getOverview(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
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

    res.json({
      totalShipments: shipments.length,
      userQueries: queries.length,
      avgRating,
      activeRoutes: shipments.filter((s) => s.status === "in_transit").length,
      agentPerformance: agentStats,
    });
  } catch (err) {
    log.error("Overview fetch failed", { error: (err as Error).message, userId: req.userId });
    next(err);
  }
}

// ── GET /api/analytics/rewards ────────────────────────────────────────────────

export async function getRewards(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
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
        factors: r.factors, // Prisma Json — already an object, no JSON.parse needed
        timestamp: r.timestamp,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/analytics/agent-report ──────────────────────────────────────────

export async function getAgentReport(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { agentName, days } = req.query;
    const lookback = parseInt((days as string) || "30");

    if (agentName) {
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
      const report = await RewardEngine.generateAgentReport(lookback);
      res.json({ agents: report, lookbackDays: lookback });
    }
  } catch (err) {
    next(err);
  }
}

// ── GET /api/analytics/agent-qtable (ADMIN) ───────────────────────────────────

export async function getQTable(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const qtable = await prisma.agentQTable.findMany({ orderBy: { agentName: "asc" } });
    res.json({ qtable });
  } catch (err) {
    next(err);
  }
}
