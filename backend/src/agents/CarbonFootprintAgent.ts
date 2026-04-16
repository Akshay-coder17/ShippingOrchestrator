/**
 * CarbonFootprintAgent - Calculates environmental impact
 */

import { ParsedShippingIntent, CarbonData } from "../types/index.js";

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
    console.log(`[CarbonFootprintAgent] Calculating carbon footprint`);

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

    console.log(
      `[CarbonFootprintAgent] Total CO2: ${result.totalCO2_kg}kg, Optimization: ${(optimization * 100).toFixed(0)}%`
    );

    return result;
  }
}
