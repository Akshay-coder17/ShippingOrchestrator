# 🚀 ShipMind - Intelligent Agentic Shipping Orchestration Platform

![ShipMind Architecture](./docs/shipmind-architecture.txt)

An **advanced, production-ready** full-stack web application demonstrating intelligent shipping logistics orchestration powered by **multi-agent AI**, **reinforcement learning**, and **real-time interactive visualization**.

## 🎯 Core Features

### 🤖 Multi-Agent AI System
- **OrchestratorAgent**: Master coordinator that decomposes user queries into specialized tasks
- **RouteOptimizerAgent**: Finds optimal multi-modal routes using Google Maps APIs
- **CarrierSelectionAgent**: Intelligently selects carriers based on price/speed/reliability
- **ComplianceAgent**: Validates customs requirements and documentation
- **RiskAssessmentAgent**: Evaluates shipping risks and suggests mitigations
- **CarbonFootprintAgent**: Calculates environmental impact per transport mode
- **PricingAgent**: Generates detailed cost breakdowns

### 🧠 Reinforcement Learning Engine
- **Q-Learning Implementation**: Each agent maintains historical reward signals
- **Meta-RL Controller**: Orchestrator learns which agents to trust based on past performance
- **Persistent Reward Storage**: All decisions and outcomes tracked in PostgreSQL
- **Agent Performance Dashboard**: Real-time monitoring of agent Q-values and success rates

### 🗺️ Interactive Map Visualization
- Real-time animated route drawing from origin → waypoints → destination
- Pulsing origin/destination markers with color-coding by transport mode
- Draggable markers for dynamic route recalculation
- 3D tilt view with transport mode segmentation

### 🎨 Glassmorphism UI with Production Animations
- Dark theme with electric blue/cyan accents
- Smooth scroll reveal animations via Intersection Observer + Framer Motion
- Custom cursor with glowing effects (GSAP-powered)
- Three.js elements: floating metric cards, agent graph topology
- Real-time agent status indicators lighting up during orchestration

### 💬 Contextual AI Chatbot
- Floating widget connected to Claude API
- System prompt includes user profile, past queries, and active shipments
- Supports natural conversation: "What's the cheapest route to Tokyo?"
- Markdown-rendered responses with domain-specific knowledge

## 🗂️ Project Structure

```
shipmind/
├── backend/
│   ├── src/
│   │   ├── agents/
│   │   │   ├── OrchestratorAgent.ts      # Master coordinator
│   │   │   ├── RouteOptimizerAgent.ts
│   │   │   ├── CarrierSelectionAgent.ts
│   │   │   ├── ComplianceAgent.ts
│   │   │   ├── RiskAssessmentAgent.ts
│   │   │   ├── CarbonFootprintAgent.ts
│   │   │   └── PricingAgent.ts
│   │   ├── rl/
│   │   │   ├── RewardEngine.ts           # Q-learning + meta-RL
│   │   │   └── MetaRLController.ts
│   │   ├── services/
│   │   │   ├── AnthropicService.ts       # Claude API wrapper
│   │   │   ├── GoogleMapsService.ts
│   │   │   └── WeatherService.ts
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── shipments.ts              # Main orchestration endpoint
│   │   │   └── analytics.ts              # RL reward history
│   │   ├── middleware/
│   │   └── types/                        # TypeScript interfaces
│   ├── prisma/
│   │   └── schema.prisma                 # PostgreSQL schema with RL tables
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/                # Layout, sidebar navigation
│   │   │   ├── map/                      # Interactive Google Maps
│   │   │   ├── three/                    # Three.js 3D elements
│   │   │   ├── chat/                     # Chatbot widget
│   │   │   └── ui/                       # Design system (Button, Card, etc)
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── NewShipment.tsx           # Main orchestration UI
│   │   │   ├── ShipmentDetail.tsx
│   │   │   ├── Analytics.tsx
│   │   │   └── Auth.tsx
│   │   ├── hooks/                        # useSocket, useApi, custom hooks
│   │   ├── store/                        # Zustand global state
│   │   ├── styles/                       # Global CSS + animations
│   │   └── types/                        # TypeScript interfaces
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
└── README.md (this file)
```

## ⚙️ Tech Stack

### Frontend
- **React 18** + TypeScript
- **Vite** for lightning-fast development
- **Tailwind CSS** + **Framer Motion** for animations
- **GSAP** for cursor and scroll effects
- **Three.js** + **react-three-fiber** for 3D
- **Google Maps API** (@react-google-maps/api)
- **Recharts** for analytics
- **Socket.io-client** for real-time updates
- **Zustand** for state management

### Backend
- **Node.js 18+** + **Express.js** (TypeScript)
- **PostgreSQL** + **Prisma ORM**
- **Redis** for session/pub-sub
- **Socket.io** for real-time streams
- **Anthropic Claude API** (claude-sonnet-4-20250514)
- **JWT** for authentication
- **Docker** ready (optional)

### Infrastructure
- PostgreSQL database
- Redis cache
- Express + Socket.io server
- Environment-based configuration

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ and **npm/yarn**
- **PostgreSQL** database (local or cloud)
- **Redis** (optional, for caching)
- **API Keys**:
  - Anthropic Claude API key
  - Google Maps API key (enable: Maps JS, Directions, Distance Matrix)
  - OpenWeather API key (optional)

### 1. Clone & Setup

```bash
# Clone the project
cd /Users/harikrishna/Desktop/ship\ deep/shipmind

# Install root dependencies
npm install

# Or use yarn
yarn install
```

### 2. Backend Setup

```bash
cd backend

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
# DATABASE_URL=postgresql://user:pass@localhost:5432/shipmind
# ANTHROPIC_API_KEY=sk-...
# GOOGLE_MAPS_API_KEY=...
# JWT_SECRET=your-secret-key

# Install dependencies
npm install

# Setup database & run migrations
npm run prisma:push

# Start dev server
npm run dev
```

Backend runs on **http://localhost:3001**

### 3. Frontend Setup

```bash
cd frontend

# Copy environment file
cp .env.example .env.local

# Edit .env.local
# VITE_GOOGLE_MAPS_KEY=your-key
# VITE_API_BASE_URL=http://localhost:3001/api

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs on **http://localhost:5173**

### 4. Test the Application

1. **Register**: Go to http://localhost:5173/auth/register and create an account
2. **Create Shipment**: Navigate to "New Shipment"
3. **Type a Query**: E.g., "Ship 500kg electronics from Chennai to Berlin by Friday, cost-optimized"
4. **Watch Orchestration**: Real-time agent activity streams, map animates route
5. **View Results**: Full shipment plan with cost, compliance, risk, carbon footprint

## 📊 Sample Shipment Plan Output

```json
{
  "shipmentId": "SHP-1712345678",
  "status": "planned",
  "query": "Ship 500kg electronics Chennai to Berlin by Friday",
  "route": {
    "origin": { "name": "Chennai, India", "lat": 13.0827, "lng": 80.2707 },
    "destination": { "name": "Berlin, Germany", "lat": 52.52, "lng": 13.405 },
    "waypoints": [
      { "name": "Dubai Jebel Ali Port", "lat": 24.97, "lng": 55.06, "role": "seaport", "mode": "sea→sea" },
      { "name": "Frankfurt Airport", "lat": 50.03, "lng": 8.57, "role": "airport", "mode": "air→road" }
    ],
    "segments": [
      { "from": "Chennai", "to": "Port", "mode": "road", "distanceKm": 20, "durationHours": 0.75 },
      { "from": "Port", "to": "Dubai", "mode": "sea", "distanceKm": 3400, "durationHours": 96 },
      { "from": "Dubai", "to": "Frankfurt", "mode": "air", "distanceKm": 4900, "durationHours": 7 },
      { "from": "Frankfurt", "to": "Berlin", "mode": "road", "distanceKm": 550, "durationHours": 5 }
    ],
    "totalDistanceKm": 8870,
    "totalDurationHours": 108.75
  },
  "carrier": { "name": "DHL Express + Maersk", "reliability": 0.94, "serviceLevel": "Express" },
  "cost": { "freight": 1200, "customs": 340, "handling": 150, "insurance": 80, "total": 1770, "currency": "USD" },
  "eta": "2024-04-20T18:00:00Z",
  "compliance": {
    "requiresCustoms": true,
    "documents": ["Commercial Invoice", "Packing List", "HS Code 8471", "CE Mark"],
    "tariffRate": "3.7%"
  },
  "risk": {
    "level": "medium",
    "factors": ["Monsoon season Chennai", "Frankfurt airport delay index: 1.2"],
    "mitigations": ["Book covered storage at Chennai Port"]
  },
  "carbon": { "totalCO2_kg": 4200, "breakdown": { "road": 12, "sea": 980, "air": 3208 } },
  "agentRewards": {
    "routeOptimizer": 0.82,
    "carrierSelection": 0.91,
    "compliance": 1.0,
    "riskAssessment": 0.75,
    "carbonFootprint": 0.89,
    "pricing": 0.85
  }
}
```

## 🧠 Reinforcement Learning Architecture

### Reward Function
```typescript
reward = (0.35 * costSavings + 
          0.25 * timeAccuracy + 
          0.30 * userSatisfaction + 
          0.10 * routeEfficiency) * 2 - 1  // [-1.0, +1.0]
```

### Q-Learning Update
```typescript
Q(s,a) = Q(s,a) + α[r + γ·max(Q(s',a')) - Q(s,a)]
// α = 0.1 (learning rate)
// γ = 0.95 (discount factor)
```

### Database Tables for RL
- `agent_rewards`: All agent decisions + rewards + success metrics
- `shipments`: Full shipment plans for outcome tracking
- `queries`: User queries with ratings (1-5 stars)
- `route_cache`: Cached routes for pattern recognition

### Agent Selection Strategy
```typescript
// Epsilon-greedy exploration
if Math.random() < epsilon (0.1):
  select random agent  // Explore
else:
  select agent with highest Q-value  // Exploit
```

## 📡 Real-Time Socket.io Events

**Client → Server:**
- `user:authenticate`: JWT auth on connect
- `shipment:request`: User submits query

**Server → Client:**
- `agent:progress`: Real-time progress (e.g., "RouteOptimizer evaluating 12 routes")
- `agent:completed`: Sub-agent finished with result
- `orchestration:complete`: Full plan generated + shipmentId
- `shipment:statusUpdate`: Status changes during fulfillment

## 🎨 UI/UX Design

### Color Scheme
```
--bg-primary: #050d1a
--bg-card: rgba(10, 25, 50, 0.7)    /* glassmorphism */
--accent: #00d4ff            /* electric blue */
--accent-green: #00ff88
--accent-orange: #ff6b35
--text-primary: #e8f4fd
--border: rgba(0, 212, 255, 0.15)
```

### Animation Highlights
1. **Custom Cursor**: Glowing dot + trailing ring (GSAP)
2. **Scroll Reveals**: Sections fade+slide on scroll (Intersection Observer + Framer Motion)
3. **Agent Graph**: 3D hexagonal nodes connected by glowing lines (Three.js)
4. **Route Animation**: Polyline strokes animate from origin→destination
5. **Loading States**: Neural network pulse visualization

## 📚 API Documentation

### Authentication
```bash
POST   /api/auth/register    # { name, email, password }
POST   /api/auth/login       # { email, password }
GET    /api/auth/profile     # Requires: Bearer token
```

### Shipments (Main Orchestration)
```bash
POST   /api/shipments/orchestrate    # { prompt: "Ship X from Y to Z..." }
GET    /api/shipments                # List user shipments
GET    /api/shipments/:id            # Get single shipment plan
PUT    /api/shipments/:id/rating     # { rating: 1-5, factors: {} }
```

### Analytics & RL
```bash
GET    /api/analytics/rewards        # Agent reward history
GET    /api/analytics/overview       # User + agent stats
GET    /api/analytics/agent-report   # Detailed agent performance
```

## 🏆 Hackathon Winning Features

✅ **Track 1 Compliance**: Complete shipping orchestration pipeline  
✅ **Agentic AI**: 7 specialized agents + master orchestrator  
✅ **RL Engine**: Q-learning with meta-RL agent weighting  
✅ **Google Maps**: Animated interactive route visualization  
✅ **NLP Intelligence**: Claude API parsing + personalization  
✅ **Database**: PostgreSQL with full query/reward history  
✅ **Real-Time**: Socket.io streaming of agent activity  
✅ **Production UI**: Glassmorphism, animations, 3D elements  
✅ **Chatbot**: Context-aware Claude assistant  
✅ **Innovation**: RL improves carrier selection with usage  

## 🔒 Security Best Practices

- ✅ JWT authentication with expiry
- ✅ Bcryptjs password hashing
- ✅ CORS configuration
- ✅ Helmet.js security headers
- ✅ Environment variable isolation
- ✅ SQL injection prevention (Prisma ORM)
- ✅ Rate limiting (production)

## 📈 Performance Optimizations

- Vite bundling with code splitting
- Tailwind CSS purge for smaller builds
- Prisma query optimization + caching
- Redis for session/pub-sub
- Lazy loading of map + 3D components
- Compression middleware (gzip)

## 🐛 Troubleshooting

### "Connection refused" on port 3001
```bash
# Kill existing process
lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Restart backend
cd backend && npm run dev
```

### Database connection fails
```bash
# Verify PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Check DATABASE_URL in .env
echo $DATABASE_URL
```

### Google Maps API key errors
- Enable these APIs in GCP console:
  - Maps JavaScript API
  - Directions API
  - Distance Matrix API
  - Geocoding API

### Frontend not connecting to backend
- Check CORS settings in `backend/src/index.ts`
- Verify proxy in `frontend/vite.config.ts`
- Frontend should be on `http://localhost:5173`

## 📝 Build & Deployment

```bash
# Production build
npm run build

# Backend
cd backend && npm run build
# Outputs to: backend/dist/

# Frontend
cd frontend && npm run build
# Outputs to: frontend/dist/

# Run production
NODE_ENV=production node backend/dist/index.js
```

## 📞 Support & Contributing

- **Issues?** Check `.env` files are configured
- **Questions?** Refer to architecture comments in source code
- **Extending?** Follow TypeScript + Prisma patterns

## 📄 License

MIT License - See LICENSE file

---

**Built for DeepFrog Hackathon Track 1: Shipping Intelligence**  
*Powered by Claude Sonnet 4, Google Maps, and Multi-Agent Reinforcement Learning*

🚀 **Ship Smart. Orchestrate Intelligently.**
