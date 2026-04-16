# 🧠 Reinforcement Learning System - Deep Dive

## Overview

ShipMind implements a **multi-agent reinforcement learning system** where specialized agents learn from past decisions to make better choices over time. This document explains the complete RL architecture.

## Q-Learning Fundamentals

### What is Q-Learning?

Q-Learning is a model-free reinforcement learning algorithm that learns the value (Q-value) of actions in states. In ShipMind:

- **State**: Shipping request characteristics (origin, destination, weight, deadline)
- **Action**: Agent's decision (e.g., "Select DHL carrier")
- **Reward**: Outcome feedback (cost savings, ETA accuracy, user satisfaction)
- **Q-Value**: Learned score representing expected value of that action

### Q-Learning Update Rule

```
Q(s,a) ← Q(s,a) + α[r + γ·max(Q(s',a')) - Q(s,a)]

Where:
α       = 0.1  (learning rate - how much to update)
r       = reward from this decision
γ       = 0.95 (discount factor - value of future rewards)
Q(s',a') = estimated value of next state
```

## ShipMind's RL Implementation

### 1. Reward Function

Every agent decision is scored on a reward scale of `-1.0` (worst) to `+1.0` (best).

```typescript
// backend/src/rl/RewardEngine.ts

interface AgentRewardFactors {
  costSavings: number;      // 0-1: actual cost vs predicted cost
  timeAccuracy: number;     // 0-1: ETA accuracy (closer to 1 = better prediction)
  userSatisfaction: number; // 1-5: user rating
  routeEfficiency: number;  // 0-1: actual distance vs optimal path
}

// Weighted combination
reward = (0.35 * costSavings + 
          0.25 * timeAccuracy + 
          0.30 * userSatisfaction/5 + 
          0.10 * routeEfficiency) * 2 - 1
```

### Weight Explanation

| Factor | Weight | Reason |
|--------|--------|--------|
| `costSavings` | 35% | Price is user's primary concern |
| `userSatisfaction` | 30% | Feedback directly reflects quality |
| `timeAccuracy` | 25% | Reliable ETAs build trust |
| `routeEfficiency` | 10% | Secondary optimization |

### 2. Database Schema for RL

```sql
-- Agent Rewards Table
CREATE TABLE agent_rewards (
  id          UUID PRIMARY KEY,
  queryId     UUID NOT NULL REFERENCES queries(id),
  shipmentId  UUID REFERENCES shipments(id),
  agentName   VARCHAR(50),        -- "CarrierSelectionAgent", "RouteOptimizer", etc
  action      TEXT,               -- "Selected DHL over FedEx"
  reward      FLOAT,              -- -1.0 to 1.0
  factors     JSONB,              -- { costSavings, timeAccuracy, ... }
  timestamp   TIMESTAMP DEFAULT NOW()
);

-- Query with user rating (for RL feedback)
CREATE TABLE queries (
  id             UUID PRIMARY KEY,
  userId         UUID NOT NULL REFERENCES users(id),
  rawPrompt      TEXT,
  parsedIntent   JSONB,
  rating         INT,              -- 1-5 stars (user satisfaction)
  timestamp      TIMESTAMP DEFAULT NOW()
);

-- Shipment tracking
CREATE TABLE shipments (
  id             UUID PRIMARY KEY,
  queryId        UUID NOT NULL REFERENCES queries(id),
  shipmentPlan   JSONB,            -- Complete plan from orchestrator
  status         VARCHAR(20),      -- "planned", "in_transit", "delivered"
  createdAt      TIMESTAMP DEFAULT NOW(),
  updatedAt      TIMESTAMP DEFAULT NOW()
);
```

### 3. Q-Value Calculation

The system calculates each agent's Q-value as a **moving average** of recent rewards:

```typescript
// backend/src/rl/RewardEngine.ts

static async getAgentQValue(agentName: string): Promise<number> {
  const history = await this.getAgentHistory(agentName, 30); // Last 30 days
  
  if (history.length === 0) {
    return 0.5; // Default Q-value for new agents
  }
  
  // Simple moving average
  const avgReward = history.reduce((sum, r) => sum + r.reward, 0) / history.length;
  
  // Normalize reward [-1, 1] to Q-value [0, 1]
  const qValue = (avgReward + 1) / 2; // Maps -1→0, 0→0.5, 1→1.0
  
  return qValue;
}
```

### 4. Epsilon-Greedy Exploration vs Exploitation

When choosing an agent, the system balances:
- **Exploitation** (90%): Pick the agent with highest Q-value
- **Exploration** (10%): Pick a random agent to learn new patterns

```typescript
static selectAgentWithExploration(
  agentQValues: Record<string, number>,
  epsilon: number = 0.1  // 10% explore, 90% exploit
): string {
  const agents = Object.keys(agentQValues);
  
  // 10% of the time: explore random agent
  if (Math.random() < epsilon) {
    return agents[Math.floor(Math.random() * agents.length)];
  }
  
  // 90% of the time: exploit best agent
  return agents.reduce((best, current) =>
    agentQValues[current] > agentQValues[best] ? current : best
  );
}
```

## Agent-Specific RL Behavior

### CarrierSelectionAgent

**Learning**: Which carriers are reliable for which routes

```
Scenario: User requests Chennai→Berlin shipment
Q-Values:
  DHL:      0.82 (historically good for this route)
  FedEx:    0.65 (slower for EU routes)
  Maersk:   0.73 (cheaper but slower)

Action: Select DHL (highest Q)

Outcome:
  - Delivery on time ✓
  - Cost: $1,800 (within estimates)
  - User rates 5/5 stars

Reward: +0.85
New Q-value for "DHL on EU routes": 0.82 + 0.1 * (0.85 - 0.82) = 0.823
```

### RouteOptimizerAgent

**Learning**: Best transport modes for different weights/deadlines

```
Scenario: 2000kg shipment, 5-day deadline
Routes evaluated:
  Multimodal (air-dominant): 3 days, $5000  Q=0.78
  Sea-dominant: 14 days, $1200             Q=0.45
  Road-only: 7 days, $2500                 Q=0.52

Action: Select multimodal (highest Q)

Outcome:
  - Delivered in 3.2 days ✓
  - Cost: $4,800 (within estimate)
  - User satisfied (4/5 stars)

Reward: +0.79
Q-value updated: Q = Q + 0.1 * (0.79 + 0.95*max(Q_next) - Q)
```

### ComplianceAgent

**Learning**: Documentation requirements by route

```
Scenario: Electronics Chennai→Germany
Knowledge base before:
  "Germany requires CE marking" Q=0.8

Outcome:
  - Documentation complete
  - Customs cleared in 2 hours
  - No delays

Reward: +0.95
Q-value: 0.8 + 0.1 * (0.95 - 0.8) = 0.815
```

## Real-Time Reward Recording

### Flow

```
User submits query:
  "Ship 500kg electronics to Berlin"
    ↓
Orchestration completes:
  Plan generated, shipmentId = SHP-001
    ↓
Agents store rewards:
  RouteOptimizer: { action: "selected multimodal", reward: pending }
  CarrierSelection: { action: "selected DHL", reward: pending }
  Compliance: { action: "validated docs", reward: pending }
    ↓
User RATES shipment (after delivery or during):
  Rating: 5 stars
    ↓
RewardEngine calculates factors:
  costSavings: 0.85 (10% cheaper than competitors)
  timeAccuracy: 0.92 (3.1 days vs 3 day estimate)
  userSatisfaction: 5/5 = 1.0
  routeEfficiency: 0.88
    ↓
Reward calculated:
  reward = 0.35*0.85 + 0.25*0.92 + 0.30*1.0 + 0.10*0.88 = 0.920
  ↓
Stored in DB:
  agent_rewards {
    agentName: "CarrierSelectionAgent",
    action: "selected DHL Express",
    reward: 0.920,
    factors: { costSavings, timeAccuracy, ... }
  }
```

## Performance Tracking

### Dashboard Analytics (`GET /api/analytics/rewards`)

```json
{
  "CarrierSelectionAgent": [
    { "date": "2024-04-10", "reward": 0.82 },
    { "date": "2024-04-11", "reward": 0.91 },
    { "date": "2024-04-12", "reward": 0.75 },
    { "date": "2024-04-13", "reward": 0.88 }
  ],
  "RouteOptimizerAgent": [
    { "date": "2024-04-10", "reward": 0.79 },
    { "date": "2024-04-11", "reward": 0.85 },
    { "date": "2024-04-12", "reward": 0.81 },
    { "date": "2024-04-13", "reward": 0.89 }
  ]
}
```

Agents with consistently high rewards (>0.75) are prioritized in future decisions.

## Convergence Over Time

### Week 1
- All agents have Q ≈ 0.5 (neutral)
- Many random selections (exploration)
- High variance in outcomes

### Week 2-4
- Agents with good decisions increase Q → 0.7-0.8
- Epsilon-greedy favors high-Q agents
- Consistency improves

### Month 2+
- Top agents: Q = 0.82-0.95
- Poor agents: Q = 0.3-0.5
- System converges to optimal agent selection
- User satisfaction increases

```
Q-Value Trajectory Example:

1.0 │                           ┌───────
    │                        ┌──┘
0.8 │          ┌────────────┘
    │       ┌──┘
0.6 │    ┌──┘
    │ ┌──┘
0.4 │─┘
    │
0.2 │
    └────────────────────────────────
      W1   W2   W3   W4   W5+
    (Agent learning curve)
```

## Meta-RL: OrchestatorAgent Learning

The orchestrator itself learns which agents to trust:

```typescript
// OnceAllAgentsComplete:
const agentQValues = await RewardEngine.getAllAgentQValues([
  "RouteOptimizer",
  "CarrierSelection",
  "Compliance",
  "RiskAssessment",
  "CarbonFootprint",
  "Pricing"
]);

// Weight the agents' contributions to final plan
const orchestrationQuality = agentQValues.reduce((sum, q) => sum + q) / 6;

// Store metacha information
// On next run, prioritize high-Q agents more heavily
```

This creates a **feedback loop** where good agent combinations reinforce each other.

## Limitations & Future Improvements

### Current Limitations
- **Simple moving average**: Doesn't account for context changes
- **No state representation**: Treats all routes equally
- **No exploration bonus**: Doesn't incentivize discovering new routes
- **Binary outcomes**: Doesn't capture partial successes

### Future Enhancements
1. **Deep Q-Networks (DQN)**: Learn Q-values from state representations
2. **Policy Gradient Methods**: Directly optimize agent selection policy
3. **Multi-Objective Optimization**: Pareto frontier for cost/time/sustainability
4. **Transfer Learning**: Share knowledge between related routes
5. **Contextual Bandits**: Adapt Q-values based on request characteristics

## Debugging RL System

### Check Agent History
```bash
curl -X GET http://localhost:3001/api/analytics/rewards \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### View Agent Report
```bash
curl -X GET http://localhost:3001/api/analytics/agent-report \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected output:
```json
{
  "RouteOptimizerAgent": {
    "name": "RouteOptimizerAgent",
    "actionCount": 42,
    "avgReward": 0.76,
    "bestReward": 0.95,
    "worstReward": 0.32,
    "successRate": 0.81
  }
}
```

### Database Queries
```sql
-- Recent agent performance
SELECT agentName, AVG(reward) as avg_reward, COUNT(*) as attempts
FROM agent_rewards
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY agentName
ORDER BY avg_reward DESC;

-- Agent learning curve
SELECT DATE(timestamp), agentName, AVG(reward) as daily_avg
FROM agent_rewards
WHERE agentName = 'CarrierSelectionAgent'
GROUP BY DATE(timestamp), agentName
ORDER BY DATE(timestamp);
```

---

**The key insight**: ShipMind doesn't just solve the immediate shipping problem—it learns from every decision to become *smarter over time*. 🚀
