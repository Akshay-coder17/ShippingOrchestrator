/**
 * RiskAssessmentAgent - Evaluates shipping risks
 */

import { ParsedShippingIntent, RiskData } from "../types/index.js";
import { childLogger } from "../lib/logger.js";

const log = childLogger("RiskAssessmentAgent");

export class RiskAssessmentAgent {
  static async execute(
    intent: ParsedShippingIntent,
    qValue: number
  ): Promise<RiskData> {
    log.info(`Assessing risks for ${intent.origin}→${intent.destination}`);

    const riskFactors: string[] = [];
    let riskLevel: "low" | "medium" | "high" = "low";

    // Route-based risks
    if (intent.origin.includes("India")) {
      riskFactors.push("Monsoon season variability");
    }
    if (intent.destination.includes("Africa")) {
      riskFactors.push("Port congestion risks");
    }

    // Weight-based risks
    if (intent.weight_kg > 10000) {
      riskFactors.push("Heavy cargo handling complexity");
      riskLevel = "medium";
    }

    // Deadline-based risks
    if (intent.deadline) {
      const deadlineDate = new Date(intent.deadline);
      const daysUntilDeadline = Math.floor(
        (deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilDeadline < 3) {
        riskFactors.push("Very tight deadline - delivery pressure");
        riskLevel = "high";
      }
    }

    // Q-value adjustment: lower Q-value = more cautious assessment
    if (qValue < 0.5) {
      riskLevel = riskLevel === "low" ? "medium" : "high";
      riskFactors.push("Agent uncertainty - conservative assessment");
    }

    const mitigations: string[] = [];
    if (riskLevel === "high") {
      mitigations.push("Use premium insurance coverage");
      mitigations.push("Book priority handling at all ports");
      mitigations.push("Daily tracking and status updates");
    } else if (riskLevel === "medium") {
      mitigations.push("Standard insurance coverage");
      mitigations.push("Real-time GPS tracking");
    }

    log.info(`Risk assessed`, { riskLevel, factorCount: riskFactors.length });

    return {
      level: riskLevel,
      factors: riskFactors,
      mitigations,
    };
  }
}
