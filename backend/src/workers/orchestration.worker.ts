/**
 * Orchestration Worker — BullMQ worker that processes shipment planning jobs
 *
 * Two instances of this worker run in parallel Docker containers (worker-1, worker-2).
 * Each instance picks up jobs atomically from the "orchestration" queue.
 *
 * Flow:
 *  1. Receive OrchestrationJobData from queue
 *  2. Run OrchestratorAgent (all 6 sub-agents + RL)
 *  3. Persist Shipment to PostgreSQL (via Prisma singleton)
 *  4. Publish Socket.io events to the user's room via Redis pub/sub
 *
 * @module workers/orchestration.worker
 */

// IMPORTANT: OpenTelemetry tracer must be initialized before any other imports
import { startTracer } from "../lib/tracer.js";
startTracer();

import { Worker, Job } from "bullmq";
import { createClient } from "redis";
import { OrchestratorAgent } from "../agents/OrchestratorAgent.js";
import { prisma } from "../lib/prisma.js";
import { redisConnection } from "../lib/queue.js";
import { childLogger } from "../lib/logger.js";
import { agentDuration, orchestrationCounter, rlRewardHistogram } from "../lib/metrics.js";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import type { OrchestrationJobData, OrchestrationJobResult } from "../lib/queue.js";
import type { ParsedShippingIntent } from "../types/index.js";

const log = childLogger("OrchestrationWorker");
const tracer = trace.getTracer("shipmind-worker");

// ─── Redis pub/sub publisher ──────────────────────────────────────────────────
// Workers publish to "socket:emit" channel — backend forwards to user rooms
const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const pubClient = createClient({ url: REDIS_URL });
pubClient
  .connect()
  .then(() => log.info("Worker Redis pub client connected"))
  .catch((err) => log.error("Worker Redis pub client failed", { error: err.message }));

/**
 * Emit a Socket.io event to a user's room via Redis pub/sub.
 * The main backend process subscribes to this channel and forwards events.
 */
async function emitToUser(
  userId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  await pubClient.publish("socket:emit", JSON.stringify({ userId, event, data }));
}

// ─── Job processor ────────────────────────────────────────────────────────────

/**
 * Process a single orchestration job:
 *  - Runs all 6 sub-agents in parallel (coordinated by OrchestratorAgent)
 *  - Persists shipment plan to DB
 *  - Emits Socket.io progress events via Redis pub/sub
 */
async function processOrchestration(
  job: Job<OrchestrationJobData, OrchestrationJobResult>
): Promise<OrchestrationJobResult> {
  const { queryId, userId, intent, rawPrompt } = job.data;

  return tracer.startActiveSpan(`orchestration.job:${queryId}`, async (span) => {
    span.setAttributes({
      "job.id": job.id ?? "unknown",
      "query.id": queryId,
      "user.id": userId,
      "worker.service": process.env.SERVICE_NAME || "shipmind-worker",
    });

    try {
      log.info("Starting orchestration job", {
        queryId,
        userId,
        jobId: job.id,
        attempt: job.attemptsMade,
      });

      await emitToUser(userId, "orchestration:started", { queryId });
      await job.updateProgress(5);

      // Progress callback — published to frontend via Socket.io
      const onProgress = async (message: string) => {
        log.debug("Agent progress", { queryId, message });
        await emitToUser(userId, "agent:progress", { queryId, message });
      };

      // ── Run OrchestratorAgent (all 6 sub-agents + RL) ──────────────────────
      const orchestrator = new OrchestratorAgent(
        queryId,
        intent as ParsedShippingIntent,
        onProgress
      );

      await job.updateProgress(15);

      const startMs = Date.now();
      const shipmentPlan = await orchestrator.orchestrate();
      const durationSec = (Date.now() - startMs) / 1000;

      // Record orchestration duration in Prometheus
      agentDuration.observe({ agent_name: "OrchestratorAgent" }, durationSec);

      await job.updateProgress(80);

      // Record RL reward metrics in Prometheus
      if (shipmentPlan.agentRewards) {
        for (const [agentName, qValue] of Object.entries(shipmentPlan.agentRewards)) {
          rlRewardHistogram.observe({ agent_name: agentName }, qValue as number);
        }
      }

      // ── Persist shipment to PostgreSQL ──────────────────────────────────────
      const shipment = await prisma.shipment.create({
        data: {
          queryId,
          shipmentPlan: shipmentPlan as any,
          status: "planned",
        },
      });

      // Update query with jobId for traceability
      await prisma.query.update({
        where: { id: queryId },
        data: { jobId: job.id },
      });

      await job.updateProgress(95);

      // ── Notify user of completion ───────────────────────────────────────────
      await emitToUser(userId, "orchestration:complete", {
        queryId,
        shipmentId: shipment.id,
        plan: shipmentPlan,
      });

      await job.updateProgress(100);

      orchestrationCounter.inc({ status: "success" });
      span.setStatus({ code: SpanStatusCode.OK });

      log.info("Orchestration job completed", {
        queryId,
        shipmentId: shipment.id,
        jobId: job.id,
        durationSec: durationSec.toFixed(2),
      });

      return {
        shipmentId: shipment.id,
        plan: shipmentPlan as any,
        agentRewards: shipmentPlan.agentRewards as Record<string, number>,
      };
    } catch (error) {
      const err = error as Error;

      log.error("Orchestration job failed", {
        queryId,
        jobId: job.id,
        error: err.message,
        stack: err.stack,
        attempt: job.attemptsMade,
      });

      orchestrationCounter.inc({ status: "failed" });
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });

      await emitToUser(userId, "orchestration:error", {
        queryId,
        error: err.message,
      });

      throw error; // Re-throw so BullMQ retries per backoff config
    } finally {
      span.end();
    }
  });
}

// ─── Worker instance ──────────────────────────────────────────────────────────

const worker = new Worker<OrchestrationJobData, OrchestrationJobResult>(
  "orchestration",
  processOrchestration,
  {
    connection: redisConnection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || "2"),
    lockDuration: 120_000,  // 2 min — prevents another worker stealing mid-flight
    lockRenewTime: 60_000,  // Renew lock every minute
  }
);

worker.on("active", (job) => {
  log.info("Job picked up", { jobId: job.id, queryId: job.data.queryId });
});

worker.on("completed", (job, result) => {
  log.info("Job completed", {
    jobId: job.id,
    queryId: job.data.queryId,
    shipmentId: result.shipmentId,
  });
});

worker.on("failed", (job, err) => {
  log.error("Job failed permanently", {
    jobId: job?.id,
    queryId: job?.data.queryId,
    error: err.message,
    attempts: job?.attemptsMade,
  });
});

worker.on("error", (err) => {
  log.error("Worker-level error", { error: err.message });
});

log.info(
  `🚀 ShipMind Orchestration Worker started`,
  {
    service: process.env.SERVICE_NAME || "shipmind-worker",
    concurrency: process.env.WORKER_CONCURRENCY || 2,
  }
);

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on("SIGTERM", async () => {
  log.info("SIGTERM received — draining worker...");
  await worker.close();
  await pubClient.quit();
  // Prisma singleton is shared — let it close gracefully
  await prisma.$disconnect();
  process.exit(0);
});
