#!/bin/bash

echo "🚀 ClickUp Clone Setup Script"
echo "=============================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found in client directory"
    exit 1
fi
npm install
echo "✅ Client dependencies installed"
echo ""

# Install server dependencies
echo "📦 Installing server dependencies..."
cd ../server
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found in server directory"
    exit 1
fi
npm install
echo "✅ Server dependencies installed"
echo ""

# Create .env files if they don't exist
cd ../client
if [ ! -f ".env" ]; then
    echo "📝 Creating client/.env.example..."
    cat > .env.example << EOF
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
EOF
    echo "⚠️  Please create client/.env with your Supabase credentials"
    echo "   Copy from client/.env.example"
else
    echo "✅ client/.env already exists"
fi

cd ../server
if [ ! -f ".env" ]; then
    echo "📝 Creating server/.env.example..."
    cat > .env.example << EOF
# Server Configuration
PORT=3000

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
EOF
    echo "⚠️  Please create server/.env with your Supabase credentials"
    echo "   Copy from server/.env.example"
else
    echo "✅ server/.env already exists"
fi

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Set up Supabase project at https://supabase.com"
echo "2. Run SQL scripts from README.md and ADDITIONAL_SQL.md"
echo "3. Create client/.env and server/.env with your Supabase credentials"
echo "4. Run 'npm run dev' in both client and server directories"
echo ""
echo "📖 See QUICK_START.md for detailed instructions"
echo ""












