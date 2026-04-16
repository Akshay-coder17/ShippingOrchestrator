/**
 * OrchestratorAgent - Master agent that coordinates all sub-agents
 */

import { ParsedShippingIntent, ShipmentPlan } from "@/types/index.js";
import { AnthropicService } from "@/services/AnthropicService.js";
import { RewardEngine } from "@/rl/RewardEngine.js";
import { RouteOptimizerAgent } from "./RouteOptimizerAgent.js";
import { CarrierSelectionAgent } from "./CarrierSelectionAgent.js";
import { ComplianceAgent } from "./ComplianceAgent.js";
import { RiskAssessmentAgent } from "./RiskAssessmentAgent.js";
import { CarbonFootprintAgent } from "./CarbonFootprintAgent.js";
import { PricingAgent } from "./PricingAgent.js";

export class OrchestratorAgent {
  private queryId: string;
  private intent: ParsedShippingIntent;
  private onProgress?: (message: string) => void;

  constructor(
    queryId: string,
    intent: ParsedShippingIntent,
    onProgress?: (message: string) => void
  ) {
    this.queryId = queryId;
    this.intent = intent;
    this.onProgress = onProgress;
  }

  /**
   * Main orchestration flow - dispatches all sub-agents and synthesizes results
   */
  async orchestrate(): Promise<ShipmentPlan> {
    this.log("🚀 OrchestratorAgent started");

    // Get Q-values to weight agent selection
    const agentQValues = await RewardEngine.getAllAgentQValues([
      "RouteOptimizer",
      "CarrierSelection",
      "Compliance",
      "RiskAssessment",
      "CarbonFootprint",
      "Pricing",
    ]);

    this.log(`📊 Agent Q-values: ${JSON.stringify(agentQValues)}`);

    // Dispatch agents in parallel
    this.log("🔄 Dispatching sub-agents...");

    const [routeData, carrierOptions, complianceInfo, riskData, carbonData, costData] = await Promise.all([
      this.executeAgent(
        RouteOptimizerAgent.execute,
        this.intent,
        "RouteOptimizer",
        agentQValues["RouteOptimizer"]
      ),
      this.executeAgent(
        CarrierSelectionAgent.execute,
        this.intent,
        "CarrierSelection",
        agentQValues["CarrierSelection"]
      ),
      this.executeAgent(
        ComplianceAgent.execute,
        this.intent,
        "Compliance",
        agentQValues["Compliance"]
      ),
      this.executeAgent(
        RiskAssessmentAgent.execute,
        this.intent,
        "RiskAssessment",
        agentQValues["RiskAssessment"]
      ),
      this.executeAgent(
        CarbonFootprintAgent.execute,
        this.intent,
        "CarbonFootprint",
        agentQValues["CarbonFootprint"]
      ),
      this.executeAgent(
        PricingAgent.execute,
        this.intent,
        "Pricing",
        agentQValues["Pricing"]
      ),
    ]);

    this.log("✅ All sub-agents completed");

    // Synthesize results
    this.log("🔗 Synthesizing agent outputs...");

    const shipmentPlan: ShipmentPlan = {
      shipmentId: `SHP-${Date.now()}`,
      status: "planned",
      query: this.intent.origin + " → " + this.intent.destination,
      route: routeData,
      carrier: carrierOptions,
      cost: costData,
      eta: new Date(Date.now() + routeData.totalDurationHours * 3600 * 1000).toISOString(),
      compliance: complianceInfo,
      risk: riskData,
      carbon: carbonData,
      agentRewards: {
        routeOptimizer: agentQValues["RouteOptimizer"],
        carrierSelection: agentQValues["CarrierSelection"],
        compliance: agentQValues["Compliance"],
        riskAssessment: agentQValues["RiskAssessment"],
        carbonFootprint: agentQValues["CarbonFootprint"],
        pricing: agentQValues["Pricing"],
      },
    };

    this.log("📦 ShipmentPlan generated successfully");

    return shipmentPlan;
  }

  /**
   * Execute a sub-agent with error handling and logging
   */
  private async executeAgent(
    agentFn: (intent: ParsedShippingIntent, qValue: number) => Promise<any>,
    intent: ParsedShippingIntent,
    agentName: string,
    qValue: number
  ): Promise<any> {
    this.log(`⚙️ Executing ${agentName} (Q-value: ${qValue.toFixed(2)})`);
    try {
      const result = await agentFn(intent, qValue);
      this.log(`✅ ${agentName} completed`);
      return result;
    } catch (error) {
      this.log(`❌ ${agentName} failed:  ${(error as Error).message}`);
      throw error;
    }
  }

  private log(message: string): void {
    if (this.onProgress) {
      this.onProgress(message);
    }
    console.log(`[OrchestratorAgent] ${message}`);
  }
}
