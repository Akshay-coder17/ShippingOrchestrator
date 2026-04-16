/**
 * Analytics Routes
 * Endpoints for retrieving RL reward history, agent performance, and system metrics
 */

import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

// Middleware to verify JWT token
const auth = (req: any, res: Response, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    req.userId = verifyToken(token); // This will decode the token
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

/**
 * GET /api/analytics/rewards
 * Get RL reward history for user's queries
 */
router.get("/rewards", auth, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    
    const rewards = await prisma.agentReward.findMany({
      where: {
        query: {
          userId: userId,
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: 100,
    });

    res.json({
      rewards: rewards.map((r) => ({
        id: r.id,
        agentName: r.agentName,
        action: r.action,
        reward: r.reward,
        factors: JSON.parse(r.factors || "{}"),
        timestamp: r.timestamp,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching rewards:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/overview
 * Get high-level stats: total shipments, avg satisfaction, agent performance
 */
router.get("/overview", auth, async (req: any, res: Response) => {
  try {
    const userId = req.userId;

    // Total queries and shipments
    const queries = await prisma.query.findMany({
      where: { userId },
    });

    const shipments = await prisma.shipment.findMany({
      where: {
        query: {
          userId: userId,
        },
      },
    });

    // Average user rating
    const ratingSum = queries.reduce((sum, q) => sum + (q.rating || 0), 0);
    const avgRating = queries.length > 0 ? ratingSum / queries.length : 0;

    // Agent performance summary
    const agentRewards = await prisma.agentReward.findMany({
      where: {
        query: {
          userId: userId,
        },
      },
    });

    const agentStats: Record<
      string,
      { totalReward: number; count: number; avgReward: number }
    > = {};

    agentRewards.forEach((ar) => {
      if (!agentStats[ar.agentName]) {
        agentStats[ar.agentName] = { totalReward: 0, count: 0, avgReward: 0 };
      }
      agentStats[ar.agentName].totalReward += ar.reward;
      agentStats[ar.agentName].count += 1;
      agentStats[ar.agentName].avgReward =
        agentStats[ar.agentName].totalReward / agentStats[ar.agentName].count;
    });

    res.json({
      totalQueries: queries.length,
      totalShipments: shipments.length,
      avgUserRating: avgRating,
      agentPerformance: agentStats,
    });
  } catch (error: any) {
    console.error("Error fetching overview:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/analytics/agent-report
 * Detailed report on a specific agent's performance
 */
router.get("/agent-report", auth, async (req: any, res: Response) => {
  try {
    const { agentName } = req.query;
    const userId = req.userId;

    if (!agentName) {
      return res.status(400).json({ error: "agentName query param required" });
    }

    const rewards = await prisma.agentReward.findMany({
      where: {
        agentName: agentName as string,
        query: {
          userId: userId,
        },
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    const totalReward = rewards.reduce((sum, r) => sum + r.reward, 0);
    const avgReward = rewards.length > 0 ? totalReward / rewards.length : 0;

    res.json({
      agentName,
      totalActions: rewards.length,
      totalReward,
      avgReward,
      recentActions: rewards.slice(0, 20).map((r) => ({
        action: r.action,
        reward: r.reward,
        factors: JSON.parse(r.factors || "{}"),
        timestamp: r.timestamp,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching agent report:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
