/**
 * BullMQ queue definitions and typed job interfaces
 *
 * All heavy async work (agent orchestration) is dispatched through this queue
 * so the HTTP handler returns immediately. Workers process jobs in parallel.
 *
 * Uses the IORedis singleton from lib/redis.ts — prevents multiple connections.
 *
 * @module lib/queue
 */

import { Queue, QueueEvents } from "bullmq";
import { redisConnection } from "./redis.js";
import logger from "./logger.js";

/** Typed data for a single orchestration job */
export interface OrchestrationJobData {
  /** Unique query identifier (also used for Socket.io room targeting) */
  queryId: string;
  /** User who submitted the query (for Socket.io room) */
  userId: string;
  /** Parsed shipping intent from Claude */
  intent: Record<string, unknown>;
  /** Raw prompt for audit log */
  rawPrompt: string;
}

/** Typed result returned by the orchestration worker */
export interface OrchestrationJobResult {
  shipmentId: string;
  plan: Record<string, unknown>;
  agentRewards: Record<string, number>;
}

/** Main orchestration queue — all shipment planning jobs go here */
export const orchestrationQueue = new Queue<
  OrchestrationJobData,
  OrchestrationJobResult
>("orchestration", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
    removeOnFail: { count: 50 },
  },
});

/** Queue event listener for monitoring / observability hooks */
export const orchestrationQueueEvents = new QueueEvents("orchestration", {
  connection: redisConnection,
});

orchestrationQueue.on("error", (err) =>
  logger.error("BullMQ queue error", { error: err.message, component: "BullMQQueue" })
);

/**
 * Add an orchestration job to the queue.
 *
 * Uses the queryId as the job ID to ensure idempotency —
 * if the same query is submitted twice, BullMQ deduplicates.
 *
 * @param data - Job payload
 * @returns BullMQ Job instance
 */
export async function enqueueOrchestration(data: OrchestrationJobData) {
  const job = await orchestrationQueue.add("orchestrate", data, {
    jobId: data.queryId, // Idempotency: same queryId = same job
  });
  logger.info("Job enqueued", {
    jobId: job.id,
    queryId: data.queryId,
    userId: data.userId,
    component: "BullMQQueue",
  });
  return job;
}

// Re-export redisConnection for workers that need it
export { redisConnection };
