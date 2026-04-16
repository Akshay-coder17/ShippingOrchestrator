/**
 * Shipment routes - Main orchestration API
 */

import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AnthropicService } from "@/services/AnthropicService.js";
import { OrchestratorAgent } from "@/agents/OrchestratorAgent.js";
import { RewardEngine } from "@/rl/RewardEngine.js";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const router = express.Router();

interface AuthRequest extends Request {
  userId?: string;
  io?: any;
}

// Middleware to extract user ID from JWT
function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: (arg0?: any) => void
) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "secret"
    ) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
}

// POST /api/shipments/orchestrate - Main NLP query endpoint
router.post(
  "/orchestrate",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const { prompt } = req.body;

    if (!prompt || !req.userId) {
      return res.status(400).json({ error: "Prompt and auth required" });
    }

    const queryId = `QRY-${Date.now()}`;

    try {
      // Save query
      const query = await prisma.query.create({
        data: {
          id: queryId,
          userId: req.userId,
          rawPrompt: prompt,
          parsedIntent: {},
        },
      });

      // Parse intent
      const intent = await AnthropicService.parseShippingQuery(prompt);

      // Update query with parsed intent
      await prisma.query.update({
        where: { id: queryId },
        data: { parsedIntent: intent },
      });

      // Emit progress event
      if (req.io) {
        req.io.to(req.userId).emit("orchestration:started", { queryId });
      }

      // Execute orchestration
      const orchestrator = new OrchestratorAgent(queryId, intent, (msg) => {
        if (req.io) {
          req.io
            .to(req.userId)
            .emit("agent:progress", { queryId, message: msg });
        }
      });

      const shipmentPlan = await orchestrator.orchestrate();

      // Save shipment
      const shipment = await prisma.shipment.create({
        data: {
          queryId,
          shipmentPlan,
          status: "planned",
        },
      });

      // Emit completion event
      if (req.io) {
        req.io.to(req.userId).emit("orchestration:complete", {
          queryId,
          shipmentId: shipment.id,
          plan: shipmentPlan,
        });
      }

      res.json({
        queryId,
        shipmentId: shipment.id,
        plan: shipmentPlan,
      });
    } catch (error) {
      console.error("Orchestration error:", error);
      if (req.io) {
        req.io
          .to(req.userId)
          .emit("orchestration:error", {
            queryId,
            error: (error as Error).message,
          });
      }
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// GET /api/shipments - List user's shipments
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const shipments = await prisma.shipment.findMany({
      where: {
        query: {
          userId: req.userId,
        },
      },
      include: {
        query: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    res.json(shipments);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/shipments/:id - Get single shipment plan
router.get(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const shipment = await prisma.shipment.findUnique({
        where: { id: req.params.id },
        include: {
          query: true,
          agentRewards: true,
        },
      });

      if (!shipment || shipment.query.userId !== req.userId) {
        return res.status(404).json({ error: "Shipment not found" });
      }

      res.json(shipment);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

// PUT /api/shipments/:id/rating - Rate shipment outcome (feeds RL)
router.put(
  "/:id/rating",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { rating, factors } = req.body;

      const shipment = await prisma.shipment.findUnique({
        where: { id: req.params.id },
        include: { query: true },
      });

      if (!shipment || shipment.query.userId !== req.userId) {
        return res.status(404).json({ error: "Shipment not found" });
      }

      // Update query rating
      await prisma.query.update({
        where: { id: shipment.queryId },
        data: { rating },
      });

      // Record rewards for each agent
      const defaultFactors = factors || {
        costSavings: 0.5,
        timeAccuracy: 0.8,
        userSatisfaction: rating / 5,
        routeEfficiency: 0.85,
      };

      const agentNames = [
        "RouteOptimizer",
        "CarrierSelection",
        "Compliance",
        "RiskAssessment",
        "CarbonFootprint",
        "Pricing",
      ];

      for (const agentName of agentNames) {
        await RewardEngine.recordReward(
          shipment.queryId,
          shipment.id,
          agentName,
          `Outcome rating: ${rating}/5`,
          defaultFactors
        );
      }

      res.json({
        success: true,
        message: "Rating recorded and RL updated",
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

export default router;
