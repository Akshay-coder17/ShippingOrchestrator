# 🔑 API Keys & Configuration Guide

## Required API Keys

### 1. Anthropic Claude API Key

**Purpose**: Powers the OrchestratorAgent for NLP parsing and query understanding

**Get Your Key**:
1. Visit https://console.anthropic.com/
2. Sign up or log in
3. Navigate to **API Keys** section
4. Click **Create Key**
5. Copy the key (format: `sk-ant-...`)

**Set in Backend**:
```bash
# backend/.env
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
```

**Model Used**: `claude-sonnet-4-20250514` (latest Sonnet model)

---

### 2. Google Maps API Key

**Purpose**: Route optimization, directions, distance calculations, and interactive map visualization

**Get Your Key**:
1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable these APIs:
   - **Maps JavaScript API** (for front-end map widget)
   - **Directions API** (for route planning)
   - **Distance Matrix API** (for cost/time calculations)
   - **Geocoding API** (for address lookup)
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy the key (format: `AIza...`)

**Set in Files**:
```bash
# backend/.env
GOOGLE_MAPS_API_KEY=AIza_your_actual_key_here

# frontend/.env.local
VITE_GOOGLE_MAPS_KEY=AIza_your_actual_key_here
```

**Restrict Your Key** (Highly Recommended):
- Go to **API Keys** → select your key
- Under "Application restrictions": Select **Web applications**
- Add your domain (e.g., `localhost:5173` for dev, `example.com` for prod)
- Under "API restrictions": Select "Maps APIs" and enable the 4 APIs listed above

---

### 3. OpenWeather API Key (Optional)

**Purpose**: Weather risk assessment for shipping routes

**Get Your Key**:
1. Visit https://openweathermap.org/api
2. Create free account
3. Go to **API Keys**
4. Copy your default key

**Set in Backend**:
```bash
# backend/.env (optional)
OPENWEATHER_API_KEY=your_openweather_key
```

---

## Database Configuration

### PostgreSQL

**Local Setup**:

**Option A: Using Docker (Recommended)**
```bash
docker-compose up -d
# Database: shipmind
# User: shipmind
# Password: shipmind_secure_password_change_me
# Port: 5432
```

**Option B: Native Installation**
```bash
# macOS (Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Linux (Ubuntu)
sudo apt install postgresql-15
sudo systemctl start postgresql

# Create database
psql -U postgres
CREATE DATABASE shipmind;
CREATE USER shipmind WITH PASSWORD 'your_secure_password';
ALTER ROLE shipmind SET client_encoding TO 'utf8';
GRANT ALL PRIVILEGES ON DATABASE shipmind TO shipmind;
\q
```

**Connection String**:
```bash
# backend/.env
DATABASE_URL="postgresql://shipmind:your_secure_password@localhost:5432/shipmind"
```

**Verify Connection**:
```bash
psql -U shipmind -d shipmind -c "SELECT NOW();"
```

---

### Redis (Optional but Recommended)

**Purpose**: Session caching, pub/sub for real-time features

**Local Setup**:

**Option A: Using Docker**
```bash
docker-compose up -d redis
# Port: 6379
```

**Option B: Native Installation**
```bash
# macOS
brew install redis
brew services start redis

# Linux
sudo apt install redis-server
sudo systemctl start redis-server
```

**Connection String**:
```bash
# backend/.env (optional)
REDIS_URL="redis://localhost:6379"
```

---

## Environment Variables Complete Reference

### Backend (`backend/.env`)

```bash
# Database
DATABASE_URL="postgresql://shipmind:password@localhost:5432/shipmind"

# API Keys  
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_MAPS_API_KEY="AIza..."
OPENWEATHER_API_KEY="your_key" # optional

# Caching
REDIS_URL="redis://localhost:6379"

# Authentication
JWT_SECRET="your-super-secret-key-min-32-chars-xxxxxxxx"
JWT_EXPIRY="7d"

# Server
PORT=3001
NODE_ENV="development"

# CORS
FRONTEND_URL="http://localhost:5173"
```

### Frontend (`frontend/.env.local`)

```bash
# Google Maps
VITE_GOOGLE_MAPS_KEY="AIza..."

# API Base
VITE_API_BASE_URL="http://localhost:3001/api"
```

---

## Verification Checklist

After configuration, verify everything works:

```bash
# 1. Check database connection
psql -U shipmind -d shipmind -c "SELECT NOW();"
# Output: current timestamp ✓

# 2. Check backend starts
cd backend
npm install
npm run prisma:push
npm run dev
# Expected: "🚀 ShipMind backend running on http://localhost:3001" ✓

# 3. Check frontendstarts
cd frontend
npm install
npm run dev
# Expected: "VITE v5.0.0  ready in XXXms" ✓

# 4. Test API connection
curl http://localhost:3001/health
# Expected: {"status":"ok"} ✓

# 5. Test authentication
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
# Expected: 200 with user + token ✓
```

---

## Troubleshooting

### "Invalid API key for Anthropic"
- Verify key starts with `sk-ant-`
- Check key is enabled in Anthropic console
- Ensure no trailing spaces in `.env`

### "Google Maps API key not found"
- Check VITE prefix for frontend: `VITE_GOOGLE_MAPS_KEY`
- Frontend uses `import.meta.env.VITE_GOOGLE_MAPS_KEY`
- Backend uses `process.env.GOOGLE_MAPS_API_KEY`

### "Database connection refused"
```bash
# Check PostgreSQL is running
psql -U postgres -c "SELECT version();"

# If not, restart
docker-compose down
docker-compose up -d postgres
sleep 5
npm run prisma:push
```

### "Map not loading in frontend"
- Check CORS settings allow localhost:5173
- Verify Maps JavaScript API is enabled in GCP
- Check browser console for errors

---

## Free Tier Limits

### Anthropic Claude
- **Free Trial**: $5 credit
- **Pay-as-you-go**: ~$0.003-$0.015 per 1K tokens
- **ShipMind Usage**: ~2-5K tokens per query

### Google Maps
- **Free Tier**: $200/month credit
- **Maps JavaScript API**: 28,800 calls/day free
- **Directions API**: 25,000 requests/day free
- **Distance Matrix API**: 25,000 requests/day free
- **ShipMind Usage**: ~1-3 API calls per query

### PostgreSQL + Redis
- **AWS RDS**: $15-100/month (t3.micro free tier available)
- **Railway**: $5+ credit/month
- **Heroku**: Removed free tier
- **Local**: Free

---

## Production Deployment Notes

For production, consider:

1. **Use environment secrets** (not .env files)
   - GitHub Secrets
   - AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault

2. **API Key Rotation**
   - Rotate keys every 90 days
   - Use separate keys for dev/staging/prod

3. **Rate Limiting**
   - Implement request rate limiting
   - Monitor API usage
   - Set up alerts for unusual activity

4. **Database Backups**
   - Daily automated backups
   - Point-in-time recovery enabled
   - Test restore procedures

5. **Error Handling**
   - Set up Sentry for error tracking
   - Log all API failures
   - Alert on repeated errors
