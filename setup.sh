#!/bin/bash

# ShipMind Development Setup Script

echo "🚀 ShipMind Local Development Setup"
echo "===================================="
echo ""

# Check Node.js
echo "✓ Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi
echo "  Node.js: $(node --version)"
echo "  NPM: $(npm --version)"
echo ""

# Check PostgreSQL
echo "✓ Checking PostgreSQL..."
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL not found. Using Docker instead..."
    if command -v docker &> /dev/null; then
        echo "  Starting PostgreSQL container..."
        docker run --name shipmind-postgres -e POSTGRES_PASSWORD=password -d -p 5432:5432 postgres:15-alpine
        sleep 3
    fi
else
    echo "  PostgreSQL: $(psql --version)"
fi
echo ""

# Setup backend
echo "📦 Setting up backend..."
cd backend
cp .env.example .env
echo "  - Created .env (⚠️ Edit with your API keys)"
npm install
npm run prisma:push
cd ..
echo ""

# Setup frontend
echo "📦 Setting up frontend..."
cd frontend
cp .env.example .env.local
echo "  - Created .env.local (⚠️ Edit with your Google Maps key)"
npm install
cd ..
echo ""

echo "✅ Setup complete!"
echo ""
echo "📖 Next steps:"
echo "  1. Edit backend/.env with your API keys"
echo "  2. Edit frontend/.env.local with Google Maps key"
echo "  3. Run: npm run dev (from project root)"
echo ""
echo "🌐 Access:"
echo "  Frontend: http://localhost:5173"
echo "  Backend: http://localhost:3001"
echo "  API: http://localhost:3001/api"
echo ""
