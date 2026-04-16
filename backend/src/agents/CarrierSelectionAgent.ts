/**
 * CarrierSelectionAgent - Selects best carriers based on criteria
 */

import { ParsedShippingIntent, CarrierData } from "../types/index.js";

interface MockCarrier {
  name: string;
  cost: number;
  speed: number;
  reliability: number;
  routes: string[];
}

export class CarrierSelectionAgent {
  private static readonly CARRIERS: MockCarrier[] = [
    {
      name: "DHL Express",
      cost: 2500,
      speed: 0.9,
      reliability: 0.96,
      routes: ["international", "express"],
    },
    {
      name: "FedEx International",
      cost: 2200,
      speed: 0.85,
      reliability: 0.93,
      routes: ["international", "standard"],
    },
    {
      name: "Maersk Line",
      cost: 1500,
      speed: 0.5,
      reliability: 0.98,
      routes: ["sea", "multimodal"],
    },
    {
      name: "CMA CGM",
      cost: 1400,
      speed: 0.48,
      reliability: 0.94,
      routes: ["sea"],
    },
    {
      name: "Lufthansa Cargo",
      cost: 3200,
      speed: 0.95,
      reliability: 0.99,
      routes: ["air", "express"],
    },
  ];

  /**
   * Select best carrier based on priority and historical Q-values
   */
  static async execute(
    intent: ParsedShippingIntent,
    qValue: number
  ): Promise<CarrierData> {
    console.log(
      `[CarrierSelectionAgent] Selecting carrier for ${intent.priority} priority`
    );

    // Score each carrier based on intent priority
    let bestCarrier = this.CARRIERS[0];
    let bestScore = -Infinity;

    for (const carrier of this.CARRIERS) {
      let score = 0;

      if (intent.priority === "cost") {
        score = (5000 - carrier.cost) / 5000; // Inverse cost
      } else if (intent.priority === "speed") {
        score = carrier.speed;
      } else {
        // balanced
        score = (carrier.speed * 0.5 + carrier.reliability * 0.5) * 100;
      }

      // Boost score with Q-value (agent confidence)
      score *= qValue > 0.6 ? 1.15 : 1.0;

      if (score > bestScore) {
        bestScore = score;
        bestCarrier = carrier;
      }
    }

    const selected: CarrierData = {
      name: bestCarrier.name,
      trackingNumber: `${bestCarrier.name.toUpperCase()}-${Date.now()}`,
      reliability: bestCarrier.reliability,
      serviceLevel: intent.priority === "speed" ? "Express" : "Standard",
    };

    console.log(`[CarrierSelectionAgent] Selected: ${selected.name}`);

    return selected;
  }
}
