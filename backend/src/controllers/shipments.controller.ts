/**
 * Shipments Controller — business logic extracted from routes (MVC pattern)
 *
 * Routes call these controller functions; no business logic lives in routes.
 * Controllers: validate input → call services → return response.
 *
 * Satisfies Maintainability: "REST API Structure must be used correctly
 * (proper controllers, services, error handling middleware, no business logic in routes)"
 *
 * @module controllers/shipments.controller
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { AnthropicService } from "../services/AnthropicService.js";
import { enqueueOrchestration } from "../lib/queue.js";
import { prisma } from "../lib/prisma.js";
import { childLogger } from "../lib/logger.js";
import { orchestrationCounter } from "../lib/metrics.js";
import { trace, SpanStatusCode } from "@opentelemetry/api";

const log = childLogger("ShipmentsController");
const tracer = trace.getTracer("shipmind-shipments");

// ── POST /api/shipments/orchestrate ──────────────────────────────────────────

/**
 * Accept a natural-language shipping prompt, parse intent via Claude,
 * persist a Query record, and enqueue an orchestration job.
 *
 * Returns 202 Accepted immediately — results streamed via Socket.io.
 */
export async function orchestrateShipment(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  return tracer.startActiveSpan("shipments.orchestrate", async (span) => {
    try {
      const { prompt } = req.body as { prompt: string };

      if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
        res.status(400).json({
          error: "prompt must be a non-empty string (min 5 characters)",
          requestId: req.requestId,
        });
        span.end();
        return;
      }

      span.setAttributes({
        "user.id": req.userId!,
        "prompt.length": prompt.length,
        "request.id": req.requestId,
      });

      log.info("Orchestration request received", {
        userId: req.userId,
        promptLength: prompt.length,
        requestId: req.requestId,
      });

      // 1. Parse shipping intent from natural language via Claude
      const intent = await AnthropicService.parseShippingIntent(prompt);

      log.info("Shipping intent parsed", {
        intent,
        requestId: req.requestId,
        userId: req.userId,
      });

      // 2. Persist the query for audit log + RL reward tracking
      const query = await prisma.query.create({
        data: {
          userId: req.userId!,
          rawPrompt: prompt,
          parsedIntent: intent as any,
        },
      });

      // 3. Enqueue BullMQ job (idempotent via queryId as job ID)
      const job = await enqueueOrchestration({
        queryId: query.id,
        userId: req.userId!,
        intent: intent as any,
        rawPrompt: prompt,
      });

      orchestrationCounter.inc({ status: "queued" });

      log.info("Orchestration job enqueued", {
        queryId: query.id,
        jobId: job.id,
        requestId: req.requestId,
        userId: req.userId,
      });

      span.setAttributes({ "job.id": job.id ?? "", "query.id": query.id });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();

      // 4. Return 202 — client subscribes to Socket.io room for results
      res.status(202).json({
        queryId: query.id,
        jobId: job.id,
        message: "Orchestration job queued — watch for Socket.io events",
        status: "queued",
      });
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.end();
      next(err); // → global error handler
    }
  });
}

// ── GET /api/shipments ────────────────────────────────────────────────────────

/**
 * List shipments for the authenticated user (paginated).
 */
export async function listShipments(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page  = parseInt(req.query.page as string || "1");
    const limit = Math.min(parseInt(req.query.limit as string || "20"), 100);
    const skip  = (page - 1) * limit;

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where: { query: { userId: req.userId! } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: { id: true, status: true, createdAt: true, queryId: true },
      }),
      prisma.shipment.count({ where: { query: { userId: req.userId! } } }),
    ]);

    res.json({
      shipments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/shipments/:id ────────────────────────────────────────────────────

/**
 * Get full shipment plan by ID (ownership verified).
 */
export async function getShipment(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const shipment = await prisma.shipment.findFirst({
      where: {
        id: req.params.id,
        query: { userId: req.userId! },
      },
    });

    if (!shipment) {
      res.status(404).json({ error: "Shipment not found", requestId: req.requestId });
      return;
    }

    res.json({ shipment });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/shipments/:id/rate ──────────────────────────────────────────────

/**
 * Rate a completed shipment (1-5 stars) — triggers Meta-RL reward update.
 */
export async function rateShipment(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { rating } = req.body as { rating: number };

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: "rating must be between 1 and 5", requestId: req.requestId });
      return;
    }

    const shipment = await prisma.shipment.findFirst({
      where: { id: req.params.id, query: { userId: req.userId! } },
      include: { query: true },
    });

    if (!shipment) {
      res.status(404).json({ error: "Shipment not found", requestId: req.requestId });
      return;
    }

    // Persist rating on the parent Query
    await prisma.query.update({
      where: { id: shipment.queryId },
      data: { rating },
    });

    log.info("Shipment rated", {
      shipmentId: shipment.id,
      queryId: shipment.queryId,
      rating,
      userId: req.userId,
      requestId: req.requestId,
    });

    res.json({ message: "Rating submitted — RL reward will update on next orchestration" });
  } catch (err) {
    next(err);
  }
}
