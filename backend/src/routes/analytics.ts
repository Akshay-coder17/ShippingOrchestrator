/**
 * Analytics Routes — thin router, delegates all business logic to controllers
 *
 * @module routes/analytics
 */

import express from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import {
  getOverview,
  getRewards,
  getAgentReport,
  getQTable,
} from "../controllers/analytics.controller.js";

const router = express.Router();

/** GET /api/analytics/overview — KPI dashboard stats */
router.get("/overview", authenticateToken, getOverview);

/** GET /api/analytics/rewards — RL reward history */
router.get("/rewards", authenticateToken, getRewards);

/** GET /api/analytics/agent-report?agentName=X&days=30 */
router.get("/agent-report", authenticateToken, getAgentReport);

/** GET /api/analytics/agent-qtable — ADMIN only: persistent Q-table values */
router.get("/agent-qtable", authenticateToken, requireRole("ADMIN"), getQTable);

export default router;
