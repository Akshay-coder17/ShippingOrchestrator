/**
 * ShipMind Backend — main Express + Socket.io server
 *
 * Initialization order (CRITICAL):
 *  1. OpenTelemetry tracer (must be first)
 *  2. Express app + HTTP server
 *  3. Socket.io with Redis adapter (multi-instance pub/sub)
 *  4. Winston request logging middleware
 *  5. Prometheus /metrics endpoint
 *  6. Routes
 *
 * @module index
 */

// ── Tracer must be initialized before ANY other imports ──────────────────────
import { startTracer } from "./lib/tracer.js";
startTracer();

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { registry, httpRequestDuration, queueDepth, activeConnections } from "./lib/metrics.js";
import logger from "./lib/logger.js";
import authRoutes from "./routes/auth.js";
import shipmentsRoutes from "./routes/shipments.js";
import analyticsRoutes from "./routes/analytics.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// ── Redis clients for Socket.io adapter (enables multi-instance pub/sub) ─────
const pubClient = createClient({ url: process.env.REDIS_URL || "redis://redis:6379" });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()])
  .then(() => {
    logger.info("Redis pub/sub clients connected for Socket.io adapter");
  })
  .catch((err) => {
    logger.error("Redis connection failed", { error: err.message });
  });

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Attach Redis adapter so workers can emit events to users via pub/sub
pubClient.once("ready", () => {
  io.adapter(createAdapter(pubClient, subClient));
  logger.info("Socket.io Redis adapter attached");
});

// ── Subscribe to worker Socket.io events published via Redis ─────────────────
// Workers publish to "socket:emit" channel — backend forwards to user rooms
subClient.once("ready", async () => {
  await subClient.subscribe("socket:emit", (message) => {
    try {
      const { userId, event, data } = JSON.parse(message);
      io.to(userId).emit(event, data);
    } catch (err) {
      logger.error("Failed to parse socket:emit message", { err });
    }
  });
  logger.info("Subscribed to socket:emit Redis channel");
});

// ── Express middleware ────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "maps.googleapis.com"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
  })
);
app.use(compression());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
// Attach UUID requestId to every request (for error log correlation)
app.use(requestIdMiddleware);

// ── Structured request logging + Prometheus metrics middleware ────────────────
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    const route = (req.route?.path ?? req.path).replace(/\/[a-f0-9-]{24,}/gi, "/:id");

    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode.toString() },
      duration
    );

    logger.info("HTTP request", {
      requestId: req.requestId, // Set by requestIdMiddleware
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(duration * 1000),
      ip: req.ip,
    });
  });

  next();
});

// ── Attach io to requests (for routes that need it) ───────────────────────────
app.use((req: any, _res, next) => {
  req.io = io;
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/shipments", shipmentsRoutes);
app.use("/api/analytics", analyticsRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: process.env.SERVICE_NAME || "shipmind-backend",
    timestamp: new Date().toISOString(),
  });
});

// ── Prometheus metrics endpoint ───────────────────────────────────────────────
app.get("/metrics", async (_req, res) => {
  try {
    // Update real-time gauges
    const { orchestrationQueue } = await import("./lib/queue.js");
    const waiting = await orchestrationQueue.getWaitingCount();
    queueDepth.set(waiting);
    activeConnections.set(io.sockets.sockets.size);

    res.set("Content-Type", registry.contentType);
    res.end(await registry.metrics());
  } catch (err) {
    res.status(500).end("Metrics unavailable");
  }
});

// ── Socket.io event handlers ──────────────────────────────────────────────────
io.on("connection", (socket) => {
  logger.info("Client connected", { socketId: socket.id });

  socket.on("user:authenticate", (data: { userId: string; token: string }) => {
    const { userId } = data;
    socket.join(userId);
    logger.info("User authenticated on socket", { socketId: socket.id, userId });
    socket.emit("authenticated", { userId });
  });

  socket.on("disconnect", () => {
    logger.info("Client disconnected", { socketId: socket.id });
  });
});

// ── 404 + Global error handler (must be last) ────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "3001", 10);

httpServer.listen(PORT, "0.0.0.0", () => {
  logger.info(`🚀 ShipMind backend running on port ${PORT}`);
  logger.info(`📡 Socket.io ready`);
  logger.info(`📊 Prometheus metrics at /metrics`);
});

export { app, io };
