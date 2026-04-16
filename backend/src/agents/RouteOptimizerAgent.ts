/**
 * RouteOptimizerAgent - Finds optimal multi-modal routes
 */

import { ParsedShippingIntent, RouteData } from "../types/index.js";
import { GoogleMapsService } from "../services/GoogleMapsService.js";

export class RouteOptimizerAgent {
  /**
   * Determine optimal route based on weight, deadline, and priority
   */
  static async execute(
    intent: ParsedShippingIntent,
    qValue: number
  ): Promise<RouteData> {
    console.log(`[RouteOptimizerAgent] Optimizing route from${intent.origin} to ${intent.destination}`);

    // Determine transport mode based on weight and deadline
    let preferredMode: "multimodal" | "road" | "sea" | "air" = "multimodal";

    if (intent.weight_kg < 100 && intent.deadline) {
      // Light cargo with tight deadline → air
      preferredMode = "air";
    } else if (intent.weight_kg > 5000) {
      // Heavy cargo → sea
      preferredMode = "sea";
    }

    // Use RL Q-value to adjust route selection strategy
    // Higher Q-value = more confidence in this agent's decisions
    const routeQAdjustment = qValue > 0.7 ? 1.2 : 1.0;

    // Get optimal route from Google Maps service
    const route = await GoogleMapsService.getOptimalRoute(
      intent.origin,
      intent.destination,
      preferredMode
    );

    // Apply Q-value based optimization boost
    route.totalDurationHours *= routeQAdjustment;

    console.log(
      `[RouteOptimizerAgent] Route optimized: ${route.totalDistanceKm}km, ${route.totalDurationHours}h`
    );

    return route;
  }
}
