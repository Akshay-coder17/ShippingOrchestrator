# 🚢 ShipMind — Intelligent Agentic Shipping Orchestration Platform

> **DeepFrog Hackathon — Track 1: Agentic AI Platform**

[![Docker](https://img.shields.io/badge/Docker-Compose-blue)](https://docs.docker.com/compose/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-PostgreSQL-green)](https://www.prisma.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-Redis-red)](https://bullmq.io/)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-Jaeger-orange)](https://opentelemetry.io/)

---

## 📋 Problem Statement

Global shipping is fragmented, opaque, and error-prone. Logistics managers spend hours manually gathering carrier quotes, verifying customs compliance, estimating carbon impact, and assessing route risk — only to make suboptimal decisions based on incomplete data.

**ShipMind** solves this with a single natural-language prompt: *"Ship 500kg electronics from Chennai to Berlin by next Friday, cost-optimized."* Seven specialized AI agents activate instantly, orchestrate in parallel, and return a complete, RL-optimized shipping plan in seconds.

---

## 💡 Solution

ShipMind is an **Intelligent Agentic Shipping Orchestration Platform** built on:

- **Multi-Agent Architecture**: 1 Orchestrator + 6 specialized sub-agents running in parallel
- **Reinforcement Learning**: Q-learning with Meta-RL (persistent cross-session Q-table in PostgreSQL)
- **Event-Driven Scalability**: BullMQ + Redis, with 2 parallel worker containers
- **Real-time Streaming**: Socket.io pushes agent progress events to the browser as they happen
- **Enterprise Security**: Google OAuth 2.0, JWT + Refresh Tokens, MFA/OTP, RBAC, AES-256-GCM PII encryption
- **Full Observability**: OpenTelemetry → Jaeger, Winston → Loki, Prometheus → Grafana

---

## 🤖 Agent Architecture

```
User Prompt (NL)
      │
      ▼
[AnthropicService] ← Claude claude-sonnet-4-20250514 parses intent
      │
      ▼
[BullMQ Queue] ──→ [Worker-1] ──┐
                ──→ [Worker-2] ──┤
                                 ▼
                     [OrchestratorAgent]
                      ┌──────────────────────────────────────┐
                      │                                      │
              [RouteOptimizerAgent]    [CarrierSelectionAgent]
              [ComplianceAgent]         [RiskAssessmentAgent]
              [CarbonFootprintAgent]    [PricingAgent]
                      └──────────────────────────────────────┘
                                 │
                      [RewardEngine (Q-learning RL)]
                                 │
                     [ShipmentPlan → PostgreSQL]
                                 │
                    [Socket.io → Frontend → Map + Globe]
```

### RL / Meta-RL Engine

- **Algorithm**: Q-learning with epsilon-greedy (ε=0.1) exploration
- **Q-update rule**: `Q ← Q + α × (r - Q)` (α=0.1)
- **Persistent Q-table**: `AgentQTable` in PostgreSQL — values survive server restarts
- **Reward factors**: Cost savings 35%, Time accuracy 25%, User satisfaction 30%, Route efficiency 10%
- **Meta-RL**: Each user rating (1-5★) triggers a reward update across all involved agents

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **AI / LLM** | Claude claude-sonnet-4-20250514 (Anthropic) |
| **Backend** | Node.js 20 · Express 4 · TypeScript 5 |
| **ORM** | Prisma 5 + PostgreSQL 16 |
| **Queue** | BullMQ 5 + Redis 7 |
| **Real-time** | Socket.io 4 + Redis Adapter (multi-instance pub/sub) |
| **Security** | passport-google-oauth20 · jsonwebtoken · bcryptjs · node:crypto AES-256-GCM |
| **Observability** | Winston + Loki · OpenTelemetry + Jaeger · prom-client + Prometheus + Grafana |
| **Frontend** | React 18 · TypeScript · Vite · Tailwind CSS |
| **3D Globe** | Three.js · @react-three/fiber · @react-three/drei |
| **Maps** | Google Maps JS API · @react-google-maps/api |
| **Animations** | Framer Motion · GSAP |
| **State** | Zustand |
| **Containers** | Docker · Docker Compose |

---

## 🗂 Project Structure (MVC)

```
Ship_deep/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # PostgreSQL schema (all models)
│   └── src/
│       ├── agents/                # 6 sub-agents + OrchestratorAgent
│       ├── lib/                   # Singletons: prisma, redis, queue, logger, metrics, tracer
│       ├── middleware/            # auth.ts (JWT verify, RBAC)
│       ├── rl/                    # RewardEngine (Q-learning + Meta-RL)
│       ├── routes/                # Express routers (auth, shipments, analytics)
│       ├── services/              # AnthropicService, AuthService, CryptoService, GoogleMapsService
│       ├── types/                 # Shared TypeScript interfaces
│       ├── workers/               # orchestration.worker.ts (BullMQ processor)
│       └── index.ts               # Express + Socket.io entry point
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── dashboard/         # Layout.tsx
│       │   ├── map/               # InteractiveMap.tsx (Google Maps animated route)
│       │   └── ui/                # GlobeScene (Three.js), CustomCursor, UI primitives
│       ├── hooks/                 # useSocket, useApi (with JWT auto-refresh)
│       ├── pages/                 # Auth, Dashboard, NewShipment, Chatbot
│       ├── store/                 # Zustand store (auth + orchestration state)
│       └── types/                 # Frontend type definitions
├── observability/
│   ├── prometheus.yml             # Scrape config
│   ├── loki-config.yml            # Loki storage config
│   └── grafana/
│       ├── provisioning/
│       │   ├── datasources/       # Auto-wires Prometheus, Loki, Jaeger
│       │   └── dashboards/        # Dashboard provider config
│       └── dashboards/
│           └── shipmind.json      # Pre-built ShipMind dashboard
└── docker-compose.yml             # All 10 services on shipmind-net
```

---

## 🔐 Security Architecture

| Feature | Implementation |
|---|---|
| Google OAuth 2.0 | passport-google-oauth20 |
| JWT Access Tokens | 15-minute HS256, issued on login/OAuth |
| Refresh Token Rotation | 7-day bcrypt-hashed tokens in PostgreSQL |
| MFA / OTP | 6-digit code, bcrypt-hashed in Redis, 10-min TTL, Nodemailer |
| RBAC | `ADMIN` / `USER` roles, `requireRole()` middleware |
| PII Encryption | AES-256-GCM via `CryptoService` (node:crypto) |
| PII Masking | Email masked in all API responses (`u***@domain.com`) |
| Helmet | CSP, HSTS, X-Frame-Options headers |

---

## 📡 Observability

| Tool | Purpose | URL |
|---|---|---|
| **Grafana** | Dashboards (HTTP metrics, agent RL, queue depth, logs) | http://localhost:3000 |
| **Prometheus** | Metrics scraping | http://localhost:9090 |
| **Jaeger** | Distributed traces (Express → Redis → Prisma → BullMQ) | http://localhost:16686 |
| **Loki** | Structured log aggregation (all Winston logs) | via Grafana |

All Winston log lines include `traceId` + `spanId` from the active OpenTelemetry span, linking logs to traces.

---

## 🚀 How to Run

### Prerequisites

- Docker Desktop (with WSL2 on Windows)
- Git

### System Setup Steps (SSS)

**1. Clone the repository**
```bash
git clone https://github.com/Akshay-coder17/ShippingOrchestrator.git
cd ShippingOrchestrator/Ship_deep
```

**2. Configure environment variables**
```bash
cp backend/.env.example .env
```

Edit `.env` and fill in:
```env
# Required for AI orchestration
ANTHROPIC_API_KEY=sk-ant-...

# Required for animated map
GOOGLE_MAPS_API_KEY=AIza...

# Required for Google OAuth (optional for local testing)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Email OTP for MFA (optional — OTP is logged to console in dev mode)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...

# Security (change these in production!)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
ENCRYPTION_KEY=your-32-byte-encryption-key-here!
```

**3. Start all services**
```bash
docker compose up --build
```

This starts 10 services:
| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001 |
| Grafana | http://localhost:3000 (admin/admin) |
| Jaeger UI | http://localhost:16686 |
| Prometheus | http://localhost:9090 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| Loki | localhost:3100 |
| Worker-1 | (internal) |
| Worker-2 | (internal) |

**4. Verify everything is healthy**
```bash
curl http://localhost:3001/health
# {"status":"ok","service":"shipmind-backend","timestamp":"..."}

curl http://localhost:3001/metrics
# # HELP shipmind_orchestrations_total ...
```

**5. Grafana dashboards**
- Open http://localhost:3000 (admin/admin)
- Go to Dashboards → ShipMind Enterprise
- Datasources (Prometheus, Loki, Jaeger) are auto-provisioned

---

## 🎮 Demo Walkthrough (For Judges)

1. **Open** http://localhost:5173
2. **Register** or click **Continue with Google**
3. Enable **MFA** (optional) — OTP is sent via email or logged to backend console
4. From the **Dashboard** — see Mission Control with live 3D Globe, GSAP metric counters, agent Q-value bars
5. Click **New Shipment** — type a natural-language prompt:
   > *"Ship 500kg electronics from Chennai to Berlin by next Friday, cost-optimized"*
6. Watch the **Agent Activity Feed** stream in real-time as BullMQ worker picks up the job
7. 6 agents run **in parallel** → RL reward scores computed → Plan appears in the results panel
8. The **Google Map** animates the route: origin → junction waypoints → destination
9. Back on Dashboard → **Agent Q-Value bars** update based on Meta-RL learning
10. Open **Jaeger** (http://localhost:16686) → find the `orchestration.job:*` trace → see all sub-agent spans
11. Open **Grafana** (http://localhost:3000) → ShipMind Enterprise dashboard → live metrics

---

## 🔒 Security Testing

```bash
# Attempt unauthenticated access to protected route
curl http://localhost:3001/api/shipments/ 
# → 401 Unauthorized

# Attempt to access admin-only endpoint as USER
curl -H "Authorization: Bearer <user_token>" http://localhost:3001/api/analytics/agent-qtable
# → 403 Forbidden

# Verify PII masking in API response
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/auth/profile
# → {"email":"u***@domain.com"} (never full email)
```

---

## 🏗 Architecture Overview

```
                        ┌─────────────────────────────────────────────────────┐
                        │              shipmind-net (Docker bridge)           │
                        │                                                     │
  Browser ──HTTPS──▶  frontend:80 (nginx)                                     │
                        │                                                     │
  Browser ──WSS──▶   backend:3001 ◀──── redis:6379 (Socket.io adapter)       │
                        │    │                   │                            │
                        │    └──▶ BullMQ Queue ──┤                            │
                        │                        ├──▶ worker-1:processor      │
                        │                        └──▶ worker-2:processor      │
                        │                                    │                │
                        │                              postgres:5432           │
                        │                                                     │
                        │  prometheus:9090 ◀──── /metrics (backend)          │
                        │  loki:3100 ◀──────────── stdout logs (Docker)       │
                        │  jaeger:16686 ◀─────── OTLP traces (all services)  │
                        │  grafana:3000 ◀──────── prometheus + loki + jaeger  │
                        └─────────────────────────────────────────────────────┘
```

**Design Principles:**
- **Singleton pattern**: Prisma client (`lib/prisma.ts`) and Redis clients (`lib/redis.ts`) — one instance per process
- **Event-driven**: HTTP handler returns 202 immediately; heavy work in BullMQ workers
- **Idempotency**: `queryId` used as BullMQ job ID — duplicate submissions are deduplicated
- **Atomicity**: Redis `SETNX`-backed job locks prevent two workers processing the same job
- **Parallel scaling**: `docker compose up --scale worker=4` to add more workers instantly

---

## 📦 Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Claude API key |
| `GOOGLE_MAPS_API_KEY` | ✅ | Google Maps JavaScript API key |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `JWT_SECRET` | ✅ | JWT signing secret (≥32 chars) |
| `ENCRYPTION_KEY` | ✅ | AES-256 key for PII encryption |
| `GOOGLE_CLIENT_ID` | ⚠️ | Google OAuth (optional for local) |
| `GOOGLE_CLIENT_SECRET` | ⚠️ | Google OAuth (optional for local) |
| `SMTP_HOST/USER/PASS` | ⚠️ | Email for MFA OTP (dev: logged to console) |
| `FRONTEND_URL` | ℹ️ | Frontend origin for CORS (default: http://localhost:5173) |
| `LOG_LEVEL` | ℹ️ | Winston log level (default: info) |
| `WORKER_CONCURRENCY` | ℹ️ | BullMQ concurrency per worker (default: 2) |

---

## 🧪 Running Without Docker (Development)

```bash
# Terminal 1 — Backend
cd backend
npm install
cp .env.example .env  # fill API keys
npx prisma migrate dev
npm run dev

# Terminal 2 — Worker
cd backend
npm run dev:worker

# Terminal 3 — Frontend
cd frontend
npm install
npm run dev
```

---

*Built for DeepFrog Hackathon 2026 — Track 1: Agentic AI Platforms*
