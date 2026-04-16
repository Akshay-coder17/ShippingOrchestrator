/**
 * Prisma Client Singleton
 *
 * Implements the official Prisma singleton pattern to ensure only ONE
 * PrismaClient instance is created across the entire backend.
 *
 * Why this matters:
 * - Prevents connection pool exhaustion (each PrismaClient opens its own pool)
 * - Avoids "too many connections" errors under load
 * - Ensures consistent query behaviour across all modules
 * - Required by the Maintainability spec (Singleton pattern for DB connection)
 *
 * Usage:
 *   import { prisma } from '../lib/prisma.js';
 *
 * @module lib/prisma
 */

import { PrismaClient } from "@prisma/client";
import logger from "./logger.js";

/** Global symbol used to cache the instance in development hot-reload */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Singleton PrismaClient instance.
 *
 * In production a fresh instance is created once.
 * In development (with tsx --watch) the instance is cached on `globalThis`
 * so hot-reloads do not create a new connection pool each time.
 */
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

logger.info("Prisma singleton ready", {
  component: "PrismaClient",
  nodeEnv: process.env.NODE_ENV,
});

export default prisma;
