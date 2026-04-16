/**
 * Shipments Routes — thin router, delegates all business logic to controllers
 *
 * MVC: Routes only handle middleware wiring + controller dispatch.
 *
 * @module routes/shipments
 */

import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  orchestrateShipment,
  listShipments,
  getShipment,
  rateShipment,
} from "../controllers/shipments.controller.js";

const router = express.Router();

/** POST /api/shipments/orchestrate — NL prompt → BullMQ job → 202 Accepted */
router.post("/orchestrate", authenticateToken, orchestrateShipment);

/** GET /api/shipments — paginated list for authenticated user */
router.get("/", authenticateToken, listShipments);

/** GET /api/shipments/:id — full plan by ID */
router.get("/:id", authenticateToken, getShipment);

/** POST /api/shipments/:id/rate — user rating triggers Meta-RL reward update */
router.post("/:id/rate", authenticateToken, rateShipment);

export default router;
