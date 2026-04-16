/**
 * AnthropicService - Claude API integration
 */

import Anthropic from "@anthropic-ai/sdk";
import { ParsedShippingIntent } from "../types/index.js";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export class AnthropicService {
  /**
   * Parse natural language shipping query into structured intent
   */
  static async parseShippingQuery(
    userPrompt: string,
    userHistory?: string[]
  ): Promise<ParsedShippingIntent> {
    const systemPrompt = `You are a shipping logistics expert. Parse the user's natural language shipping request into structured JSON.
    Extract: origin (city, country), destination (city, country), weight_kg, deadline (if mentioned), priority (cost/speed/sustainability), goods_category.
    Return ONLY valid JSON, no other text.`;

    const conversationContext =
      userHistory && userHistory.length > 0
        ? `Recent user queries:\n${userHistory.join("\n")}\n\n`
        : "";

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `${conversationContext}Parse this shipping request:\n"${userPrompt}"`,
        },
      ],
      system: systemPrompt,
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    return JSON.parse(content.text);
  }

  /**
   * Generate orchestration plan using Claude
   */
  static async generateOrchestrationPlan(
    intent: ParsedShippingIntent,
    routeData: any,
    carrierOptions: any,
    complianceInfo: any,
    riskData: any,
    carbonData: any,
    costData: any
  ): Promise<string> {
    const systemPrompt = `You are a master shipping orchestrator. Synthesize all agent outputs into a coherent shipping plan.
    Consider tradeoffs between cost, speed, sustainability, and risk.
    Provide clear reasoning for your final recommendation.`;

    const agentOutputs = `
    Route Options: ${JSON.stringify(routeData)}
    Carrier Options: ${JSON.stringify(carrierOptions)}
    Compliance Requirements: ${JSON.stringify(complianceInfo)}
    Risk Assessment: ${JSON.stringify(riskData)}
    Carbon Impact: ${JSON.stringify(carbonData)}
    Pricing: ${JSON.stringify(costData)}
    `;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Please create the best shipping plan based on these agent outputs:\n${agentOutputs}`,
        },
      ],
      system: systemPrompt,
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    return content.text;
  }

  /**
   * Stream chat responses for the chatbot widget
   */
  static async *streamChatResponse(
    userMessage: string,
    systemContext: string,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
  ) {
    const messages = [
      ...conversationHistory,
      { role: "user" as const, content: userMessage },
    ];

    const stream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemContext,
      messages,
    });

    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta"
      ) {
        yield chunk.delta.text;
      }
    }
  }
}
