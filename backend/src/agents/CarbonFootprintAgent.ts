/**
 * CarbonFootprintAgent - Calculates environmental impact
 */

import { ParsedShippingIntent, CarbonData } from "../types/index.js";
import { childLogger } from "../lib/logger.js";

const log = childLogger("CarbonFootprintAgent");

export class CarbonFootprintAgent {
  // CO2 emissions per km per kg (in grams)
  private static readonly CO2_RATES = {
    road: 0.1, // 100g CO2 per km per kg
    sea: 0.01, // 10g CO2 per km per kg (most efficient)
    air: 0.5, // 500g CO2 per km per kg (least efficient)
  };

  static async execute(
    intent: ParsedShippingIntent,
    qValue: number
  ): Promise<CarbonData> {
    log.info(`Calculating carbon footprint`, { weightKg: intent.weight_kg });

    // Mock route breakdown for demo
    const roadKm = 50;
    const seaKm = 3400;
    const airKm = 4900;

    const roadCO2 = roadKm * intent.weight_kg * this.CO2_RATES.road;
    const seaCO2 = seaKm * intent.weight_kg * this.CO2_RATES.sea;
    const airCO2 = airKm * intent.weight_kg * this.CO2_RATES.air;

    const totalCO2 = roadCO2 + seaCO2 + airCO2;

    // Q-value adjustment: higher Q-value can suggest optimized routing
    const optimization = qValue > 0.75 ? 0.85 : 1.0;

    const result: CarbonData = {
      totalCO2_kg: Math.round((totalCO2 / 1000) * optimization),
      breakdown: {
        road: Math.round(roadCO2 / 1000),
        sea: Math.round(seaCO2 / 1000),
        air: Math.round(airCO2 / 1000),
      },
    };

    log.info(`Carbon footprint calculated`, { totalCO2_kg: result.totalCO2_kg, optimization: `${(optimization * 100).toFixed(0)}%` });

    return result;
  }
}
