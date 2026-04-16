/**
 * Redis Singleton Clients
 *
 * Provides singleton instances for:
 *  1. `redis`       — Standard node-redis client (used by AuthService for OTP, etc.)
 *  2. `ioredisConn` — IORedis client (required by BullMQ)
 *
 * Re-using the same connection instances across the entire backend avoids
 * connection saturation and satisfies the Maintainability singleton pattern.
 *
 * @module lib/redis
 */

import { createClient, RedisClientType } from "redis";
import IORedis from "ioredis";
import logger from "./logger.js";

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";

// ── Standard node-redis client (used for OTP, pub/sub helpers) ────────────────
let _redis: RedisClientType | null = null;

export function getRedisClient(): RedisClientType {
  if (!_redis) {
    _redis = createClient({ url: REDIS_URL }) as RedisClientType;

    _redis.on("error", (err) =>
      logger.error("Redis client error", { error: err.message, component: "Redis" })
    );
    _redis.on("connect", () =>
      logger.info("Redis client connected", { component: "Redis" })
    );

    // Connect immediately (fire-and-forget, errors handled by event listener)
    _redis.connect().catch((err) =>
      logger.error("Redis initial connect failed", { error: err.message, component: "Redis" })
    );
  }
  return _redis;
}

// ── IORedis client (BullMQ requires IORedis) ──────────────────────────────────
let _ioredis: IORedis | null = null;

export function getIORedisClient(): IORedis {
  if (!_ioredis) {
    _ioredis = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    });

    _ioredis.on("error", (err) =>
      logger.error("IORedis client error", { error: err.message, component: "IORedis" })
    );
    _ioredis.on("connect", () =>
      logger.info("IORedis client connected", { component: "IORedis" })
    );
  }
  return _ioredis;
}

// Export pre-initialized instances for convenience
export const redis = getRedisClient();
export const redisConnection = getIORedisClient();
