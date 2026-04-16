/**
 * Shipment routes — main orchestration API (now queue-backed)
 *
 * POST /orchestrate dispatches a BullMQ job and returns immediately.
 * Results stream back to the client via Socket.io (user room).
 *
 * @module routes/shipments
 */

import express, { Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AnthropicService } from "../services/AnthropicService.js";
import { RewardEngine } from "../rl/RewardEngine.js";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth.js";
import { enqueueOrchestration } from "../lib/queue.js";
import { orchestrationCounter } from "../lib/metrics.js";
import { childLogger } from "../lib/logger.js";
import { trace } from "@opentelemetry/api";

const log = childLogger("ShipmentsRoutes");
const tracer = trace.getTracer("shipmind-shipments");
const router = express.Router();

// ─── POST /api/shipments/orchestrate ─────────────────────────────────────────
/**
 * Main NLP → shipment orchestration endpoint.
 *
 * The heavy work (OrchestratorAgent + 6 sub-agents + RL) is dispatched to
 * a BullMQ worker queue. This handler returns immediately with a queryId/jobId
 * so the frontend can listen for Socket.io events on the user's room.
 */
router.post(
  "/orchestrate",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const span = tracer.startSpan("shipments.orchestrate.dispatch");

    try {
      const { prompt } = req.body;

      if (!prompt?.trim() || !req.userId) {
        span.end();
        return res.status(400).json({ error: "Prompt and authentication required" });
      }

      // 1. Parse intent synchronously (fast — Claude call)
      log.info("Parsing shipping intent", { userId: req.userId, promptLength: prompt.length });
      const intent = await AnthropicService.parseShippingQuery(prompt);

      // 2. Persist query record
      const query = await prisma.query.create({
        data: {
          userId: req.userId,
          rawPrompt: prompt,
          parsedIntent: intent as any,
        },
      });

      // 3. Dispatch heavy orchestration to BullMQ worker
      const job = await enqueueOrchestration({
        queryId: query.id,
        userId: req.userId,
        intent: intent as any,
        rawPrompt: prompt,
      });

      log.info("Orchestration job enqueued", {
        queryId: query.id,
        jobId: job.id,
        userId: req.userId,
      });

      orchestrationCounter.inc({ status: "dispatched" });

      span.setAttributes({
        "query.id": query.id,
        "job.id": job.id ?? "unknown",
      });
      span.end();

      // Return immediately — frontend listens for Socket.io events
      res.status(202).json({
        queryId: query.id,
        jobId: job.id,
        message: "Orchestration started — listen for socket events on your room",
      });
    } catch (error) {
      const err = error as Error;
      log.error("Orchestration dispatch failed", { error: err.message });
      orchestrationCounter.inc({ status: "dispatch_failed" });
      span.recordException(err);
      span.end();
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── GET /api/shipments ───────────────────────────────────────────────────────
router.get("/", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shipments = await prisma.shipment.findMany({
      where: { query: { userId: req.userId } },
      include: {
        query: {
          select: {
            id: true,
            rawPrompt: true,
            rating: true,
            timestamp: true,
            jobId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json(shipments);
  } catch (error) {
    log.error("List shipments error", { error: (error as Error).message });
    res.status(500).json({ error: "Failed to fetch shipments" });
  }
});

// ─── GET /api/shipments/:id ───────────────────────────────────────────────────
router.get("/:id", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: req.params.id },
      include: {
        query: { select: { id: true, userId: true, rawPrompt: true, rating: true, jobId: true } },
        agentRewards: true,
      },
    });

    if (!shipment || shipment.query.userId !== req.userId) {
      return res.status(404).json({ error: "Shipment not found" });
    }

    // Strip userId from nested query before returning
    const { userId: _uid, ...safeQuery } = shipment.query;
    res.json({ ...shipment, query: safeQuery });
  } catch (error) {
    log.error("Get shipment error", { error: (error as Error).message });
    res.status(500).json({ error: "Failed to fetch shipment" });
  }
});

// ─── PUT /api/shipments/:id/rating ───────────────────────────────────────────
router.put(
  "/:id/rating",
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { rating, factors } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be 1-5" });
      }

      const shipment = await prisma.shipment.findUnique({
        where: { id: req.params.id },
        include: { query: { select: { id: true, userId: true } } },
      });

      if (!shipment || shipment.query.userId !== req.userId) {
        return res.status(404).json({ error: "Shipment not found" });
      }

      await prisma.query.update({
        where: { id: shipment.queryId },
        data: { rating },
      });

      const rewardFactors = factors || {
        costSavings: 0.5,
        timeAccuracy: 0.8,
        userSatisfaction: rating / 5,
        routeEfficiency: 0.85,
      };

      const agentNames = [
        "RouteOptimizer", "CarrierSelection", "Compliance",
        "RiskAssessment", "CarbonFootprint", "Pricing",
      ];

      for (const agentName of agentNames) {
        await RewardEngine.recordReward(
          shipment.queryId,
          shipment.id,
          agentName,
          `Outcome rating: ${rating}/5`,
          rewardFactors
        );
      }

      log.info("Rating recorded", { shipmentId: shipment.id, rating });

      res.json({ success: true, message: "Rating recorded and RL updated" });
    } catch (error) {
      log.error("Rating error", { error: (error as Error).message });
      res.status(500).json({ error: "Failed to record rating" });
    }
  }
);

// ─── GET /api/shipments/:id/status ───────────────────────────────────────────
/**
 * Poll job status from BullMQ (for clients that can't use WebSockets)
 */
router.get("/:id/status", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orchestrationQueue } = await import("../lib/queue.js");
    const queryId = req.params.id;

    const job = await orchestrationQueue.getJob(queryId);
    if (!job) {
      return res.json({ status: "not_found" });
    }

    const state = await job.getState();
    const progress = job.progress;

    res.json({ status: state, progress });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch job status" });
  }
});

export default router;
