/**
 * RewardEngine - Q-learning based reinforcement learning for agents
 */

import { PrismaClient } from "@prisma/client";
import { AgentRewardRecord } from "@/types/index.js";

const prisma = new PrismaClient();

export class RewardEngine {
  // Q-learning parameters
  private static readonly LEARNING_RATE = 0.1;
  private static readonly DISCOUNT_FACTOR = 0.95;
  private static readonly EXPLORATION_FACTOR = 0.1;

  /**
   * Calculate reward based on outcome factors
   * Reward ranges from -1.0 (worst) to +1.0 (best)
   */
  static calculateReward(factors: {
    costSavings: number; // 0-1 scale (% savings)
    timeAccuracy: number; // 0-1 scale (ETA accuracy)
    userSatisfaction: number; // 1-5 stars -> convert to 0-1 scale
    routeEfficiency: number; // 0-1 scale (actual/optimal distance ratio)
  }): number {
    // Weighted combination of factors
    const weights = {
      cost: 0.35,
      time: 0.25,
      satisfaction: 0.3,
      efficiency: 0.1,
    };

    const normalizedSatisfaction =
      (factors.userSatisfaction - 1) / 4; // Convert 1-5 to 0-1

    const reward =
      weights.cost * factors.costSavings +
      weights.time * factors.timeAccuracy +
      weights.satisfaction * normalizedSatisfaction +
      weights.efficiency * factors.routeEfficiency;

    // Normalize to -1 to +1 range
    return reward * 2 - 1;
  }

  /**
   * Record agent reward in database
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
      data: {
        queryId,
        shipmentId,
        agentName,
        action,
        reward,
        factors,
      },
    });

    return {
      queryId: record.queryId,
      agentName: record.agentName,
      action: record.action,
      reward: record.reward,
      factors,
    };
  }

  /**
   * Get agent's historical rewards (for Q-value lookup)
   */
  static async getAgentHistory(
    agentName: string,
    lookbackDays: number = 30
  ): Promise<AgentRewardRecord[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    const records = await prisma.agentReward.findMany({
      where: {
        agentName,
        timestamp: {
          gte: cutoffDate,
        },
      },
      orderBy: {
        timestamp: "desc",
      },
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
   * Calculate Q-value using simple moving average of recent rewards
   * In production, you'd implement full tabular Q-learning or DQN
   */
  static async getAgentQValue(agentName: string): Promise<number> {
    const history = await this.getAgentHistory(agentName, 30);

    if (history.length === 0) {
      return 0.5; // Neutral/default Q-value for new agents
    }

    // Simple moving average of recent rewards
    const avgReward =
      history.reduce((sum, r) => sum + r.reward, 0) / history.length;

    // Normalize to 0-1 range (Q-values typically 0-1 in this context)
    return (avgReward + 1) / 2;
  }

  /**
   * Get all agents' Q-values for orchestrator to use in weighted selection
   */
  static async getAllAgentQValues(agentNames: string[]): Promise<
    Record<string, number>
  > {
    const qValues: Record<string, number> = {};

    for (const agentName of agentNames) {
      qValues[agentName] = await this.getAgentQValue(agentName);
    }

    return qValues;
  }

  /**
   * Apply epsilon-greedy exploration strategy
   * Select agent with best Q-value with (1-epsilon) probability,
   * random agent with epsilon probability
   */
  static selectAgentWithExploration(
    agentQValues: Record<string, number>,
    epsilon: number = this.EXPLORATION_FACTOR
  ): string {
    const agents = Object.keys(agentQValues);

    // Explore: random selection
    if (Math.random() < epsilon) {
      return agents[Math.floor(Math.random() * agents.length)];
    }

    // Exploit: select best Q-value agent
    return agents.reduce((best, current) =>
      agentQValues[current] > agentQValues[best] ? current : best
    );
  }

  /**
   * Generate agent performance report for dashboard
   */
  static async generateAgentReport(lookbackDays: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    const rewards = await prisma.agentReward.findMany({
      where: {
        timestamp: {
          gte: cutoffDate,
        },
      },
    });

    const agentStats: Record<
      string,
      {
        name: string;
        actionCount: number;
        avgReward: number;
        bestReward: number;
        worstReward: number;
        successRate: number;
      }
    > = {};

    rewards.forEach((r) => {
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

      const stats = agentStats[r.agentName];
      stats.actionCount++;
      stats.avgReward += r.reward;
      stats.bestReward = Math.max(stats.bestReward, r.reward);
      stats.worstReward = Math.min(stats.worstReward, r.reward);
      if (r.reward > 0.5) stats.successRate++;
    });

    // Normalize averages
    Object.values(agentStats).forEach((stats) => {
      stats.avgReward /= stats.actionCount || 1;
      stats.successRate /= stats.actionCount || 1;
    });

    return agentStats;
  }
}
