/**
 * Main Express + Socket.io server
 */

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import shipmentsRoutes from "./routes/shipments.js";
import analyticsRoutes from "./routes/analytics.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Attach io to request object for use in routes
app.use((req: any, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/shipments", shipmentsRoutes);
app.use("/api/analytics", analyticsRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Socket.io event handlers
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("user:authenticate", (data) => {
    const { userId, token } = data;
    socket.join(userId);
    console.log(`User ${userId} joined room`);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use(
  (
    error: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Error:", error);
    res
      .status(error.status || 500)
      .json({ error: error.message || "Internal server error" });
  }
);

// Start server
const PORT = parseInt(process.env.PORT || "3001", 10);

httpServer.listen(PORT, () => {
  console.log(`🚀 ShipMind backend running on http://localhost:${PORT}`);
  console.log(`📡 Socket.io ready at ws://localhost:${PORT}`);
});

export { app, io };
