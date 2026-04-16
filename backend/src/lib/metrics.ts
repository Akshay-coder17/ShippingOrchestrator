/**
 * Prometheus metrics registry — exposes /metrics endpoint
 *
 * Tracks:
 * - HTTP request duration (histogram)
 * - Active BullMQ jobs (gauge)
 * - Agent execution time (histogram per agent)
 * - Total orchestrations (counter)
 *
 * @module metrics
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();

// Collect Node.js default metrics (memory, event loop, GC, etc.)
collectDefaultMetrics({ register: registry, prefix: "shipmind_" });

/** HTTP request duration by route and method */
export const httpRequestDuration = new Histogram({
  name: "shipmind_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

/** Total orchestrations dispatched */
export const orchestrationCounter = new Counter({
  name: "shipmind_orchestrations_total",
  help: "Total number of orchestration jobs dispatched",
  labelNames: ["status"],
  registers: [registry],
});

/** Agent execution duration per agent */
export const agentDuration = new Histogram({
  name: "shipmind_agent_duration_seconds",
  help: "Duration of individual agent execution",
  labelNames: ["agent_name"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [registry],
});

/** Current BullMQ queue depth */
export const queueDepth = new Gauge({
  name: "shipmind_queue_depth",
  help: "Number of jobs waiting in the orchestration queue",
  registers: [registry],
});

/** Active WebSocket connections */
export const activeConnections = new Gauge({
  name: "shipmind_active_websocket_connections",
  help: "Number of active Socket.io connections",
  registers: [registry],
});

/** RL reward histogram — tracks the quality of agent decisions */
export const rlRewardHistogram = new Histogram({
  name: "shipmind_rl_reward",
  help: "Distribution of RL reward values per agent",
  labelNames: ["agent_name"],
  buckets: [-1, -0.5, 0, 0.25, 0.5, 0.75, 1],
  registers: [registry],
});
