/**
 * PricingAgent - Calculates shipping costs
 */

import { ParsedShippingIntent, CostBreakdown } from "../types/index.js";

export class PricingAgent {
  static async execute(
    intent: ParsedShippingIntent,
    qValue: number
  ): Promise<CostBreakdown> {
    console.log(`[PricingAgent] Calculating costs for ${intent.weight_kg}kg shipment`);

    // Base freight cost (per kg)
    const freightCostPerKg = 2.5;
    let freight = intent.weight_kg * freightCostPerKg;

    // Weight-based discount
    if (intent.weight_kg > 1000) {
      freight *= 0.85; // 15% discount for heavy cargo
    } else if (intent.weight_kg > 100) {
      freight *= 0.9; // 10% discount for medium cargo
    }

    // Customs based on destination
    let customs = freight * 0.15; // 15% customs overhead
    if (intent.destination.includes("EU")) {
      customs *= 1.2; // Higher customs for EU
    }

    // Handling fees
    const handling = 150 + intent.weight_kg * 0.5;

    // Insurance (1.5% of freight)
    const insurance = freight * 0.015;

    // Q-value optimization: higher Q = better pricing negotiated
    const qAdjustment = qValue > 0.7 ? 0.92 : 1.0; // 8% discount for high-confidence agents

    const total = (freight + customs + handling + insurance) * qAdjustment;

    const result: CostBreakdown = {
      freight: Math.round(freight * qAdjustment),
      customs: Math.round(customs * qAdjustment),
      handling: Math.round(handling * qAdjustment),
      insurance: Math.round(insurance * qAdjustment),
      total: Math.round(total),
      currency: "USD",
    };

    console.log(
      `[PricingAgent] Total cost: $${result.total} (Q-adjusted: ${(qAdjustment * 100).toFixed(0)}%)`
    );

    return result;
  }
}
