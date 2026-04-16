/**
 * RewardEngine — Q-learning based RL for adaptive agent weighting
 *
 * Implements:
 *  - Weighted reward calculation from cost/time/satisfaction/efficiency factors
 *  - Persistent Q-values stored in AgentQTable (DB) for cross-session Meta-RL
 *  - Epsilon-greedy exploration strategy
 *  - Agent performance report for dashboard
 *
 * Uses Prisma singleton from lib/prisma.ts.
 *
 * @module rl/RewardEngine
 */

import { prisma } from "../lib/prisma.js";
import { AgentRewardRecord } from "../types/index.js";
import { childLogger } from "../lib/logger.js";

const log = childLogger("RewardEngine");

export class RewardEngine {
  // Q-learning hyperparameters
  private static readonly LEARNING_RATE = 0.1;
  private static readonly DISCOUNT_FACTOR = 0.95;
  private static readonly EXPLORATION_FACTOR = 0.1; // ε for epsilon-greedy

  /**
   * Calculate composite reward from outcome factors.
   * Reward is in [-1.0, +1.0] range.
   *
   * Weights:
   *  - Cost savings:       35%
   *  - Time accuracy:      25%
   *  - User satisfaction:  30%
   *  - Route efficiency:   10%
   */
  static calculateReward(factors: {
    costSavings: number;       // 0-1 scale (% savings vs benchmark)
    timeAccuracy: number;      // 0-1 scale (ETA accuracy)
    userSatisfaction: number;  // 1-5 stars
    routeEfficiency: number;   // 0-1 scale (actual/optimal distance)
  }): number {
    const weights = { cost: 0.35, time: 0.25, satisfaction: 0.3, efficiency: 0.1 };

    // Normalize 1-5 star rating to 0-1
    const normalizedSatisfaction = (factors.userSatisfaction - 1) / 4;

    const raw =
      weights.cost * factors.costSavings +
      weights.time * factors.timeAccuracy +
      weights.satisfaction * normalizedSatisfaction +
      weights.efficiency * factors.routeEfficiency;

    // Map [0, 1] → [-1, +1]
    return raw * 2 - 1;
  }

  /**
   * Persist an agent reward record and update the AgentQTable.
   */
  static async recordReward(
    queryId: string,
    shipmentId: string | null,
    agentName: string,
    action: string,
    factors: {
      costSavings: number;
      timeAccuracy: number;
      userSatisfaction: number;
      routeEfficiency: number;
    }
  ): Promise<AgentRewardRecord> {
    const reward = this.calculateReward(factors);

    const record = await prisma.agentReward.create({
      data: { queryId, shipmentId, agentName, action, reward, factors },
    });

    // Update persistent Q-table (Meta-RL across sessions)
    await this.updateQTable(agentName, reward);

    log.debug("Agent reward recorded", { agentName, reward: reward.toFixed(3), queryId });

    return {
      queryId: record.queryId,
      agentName: record.agentName,
      action: record.action,
      reward: record.reward,
      factors,
    };
  }

  /**
   * Update the persistent AgentQTable using the Q-learning update rule:
   *   Q(s,a) ← Q(s,a) + α * [r + γ * max(Q(s')) - Q(s,a)]
   *
   * Simplified (stateless single-agent): Q ← Q + α * (r - Q)
   */
  private static async updateQTable(agentName: string, reward: number): Promise<void> {
    const existing = await prisma.agentQTable.findUnique({ where: { agentName } });

    const currentQ = existing?.qValue ?? 0.5;
    const newQ = currentQ + this.LEARNING_RATE * (reward - currentQ);

    await prisma.agentQTable.upsert({
      where: { agentName },
      create: { agentName, qValue: newQ, episodeCount: 1 },
      update: {
        qValue: newQ,
        episodeCount: { increment: 1 },
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Get an agent's current Q-value from the persistent table.
   * Falls back to 0.5 (neutral) if the agent has no history.
   */
  static async getAgentQValue(agentName: string): Promise<number> {
    // First check persistent Q-table (cross-session learning)
    const table = await prisma.agentQTable.findUnique({ where: { agentName } });
    if (table) return Math.max(0, Math.min(1, table.qValue));

    // Fallback: compute from recent reward history
    const history = await this.getAgentHistory(agentName, 30);
    if (history.length === 0) return 0.5;

    const avgReward = history.reduce((sum, r) => sum + r.reward, 0) / history.length;
    return (avgReward + 1) / 2;
  }

  /**
   * Get Q-values for all named agents (used by OrchestratorAgent).
   */
  static async getAllAgentQValues(
    agentNames: string[]
  ): Promise<Record<string, number>> {
    const qValues: Record<string, number> = {};
    await Promise.all(
      agentNames.map(async (name) => {
        qValues[name] = await this.getAgentQValue(name);
      })
    );
    log.info("Agent Q-values loaded", { qValues });
    return qValues;
  }

  /**
   * Epsilon-greedy agent selection.
   * Explores with probability ε, exploits (best Q-value) otherwise.
   */
  static selectAgentWithExploration(
    agentQValues: Record<string, number>,
    epsilon: number = this.EXPLORATION_FACTOR
  ): string {
    const agents = Object.keys(agentQValues);
    if (Math.random() < epsilon) {
      return agents[Math.floor(Math.random() * agents.length)];
    }
    return agents.reduce((best, cur) =>
      agentQValues[cur] > agentQValues[best] ? cur : best
    );
  }

  /**
   * Get an agent's reward history for the last N days.
   */
  static async getAgentHistory(
    agentName: string,
    lookbackDays = 30
  ): Promise<AgentRewardRecord[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);

    const records = await prisma.agentReward.findMany({
      where: { agentName, timestamp: { gte: cutoff } },
      orderBy: { timestamp: "desc" },
    });

    return records.map((r) => ({
      queryId: r.queryId,
      agentName: r.agentName,
      action: r.action,
      reward: r.reward,
      factors: r.factors as any,
    }));
  }

  /**
   * Generate agent performance report for the dashboard (last N days).
   */
  static async generateAgentReport(lookbackDays = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);

    const rewards = await prisma.agentReward.findMany({
      where: { timestamp: { gte: cutoff } },
    });

    const agentStats: Record<
      string,
      { name: string; actionCount: number; avgReward: number; bestReward: number; worstReward: number; successRate: number }
    > = {};

    for (const r of rewards) {
      if (!agentStats[r.agentName]) {
        agentStats[r.agentName] = {
          name: r.agentName,
          actionCount: 0,
          avgReward: 0,
          bestReward: -1,
          worstReward: 1,
          successRate: 0,
        };
      }
      const s = agentStats[r.agentName];
      s.actionCount++;
      s.avgReward += r.reward;
      s.bestReward = Math.max(s.bestReward, r.reward);
      s.worstReward = Math.min(s.worstReward, r.reward);
      if (r.reward > 0.5) s.successRate++;
    }

    for (const s of Object.values(agentStats)) {
      s.avgReward /= s.actionCount || 1;
      s.successRate /= s.actionCount || 1;
    }

    return agentStats;
  }
}
