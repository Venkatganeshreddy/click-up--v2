# ClickUp Clone

A project management application built with React, Express, and Supabase.

## 📚 Documentation

- **[QUICK_START.md](./QUICK_START.md)** - Get started in 5 minutes
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide
- **[ADDITIONAL_SQL.md](./ADDITIONAL_SQL.md)** - Database schema setup

## Features

- User authentication (register/login)
- Project management (create, edit, delete)
- Task management with Kanban board
- Drag-and-drop task organization
- Task priorities and due dates
- **Task comments** - Add comments to tasks for collaboration
- **Tags** - Organize tasks with custom tags
- **Global search** - Search across tasks and projects (Cmd/Ctrl + K)
- **Activity feed** - Track all activity across your workspace
- Real-time updates
- Calendar view for task scheduling
- Timeline view for project planning
- Sprint management with burndown charts
- Team collaboration and member management
- Reports and analytics

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to SQL Editor and run the following:

```sql
-- Projects table
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE')),
  priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  due_date TIMESTAMPTZ,
  position INTEGER DEFAULT 0,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can create own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = owner_id);

-- RLS Policies for tasks
CREATE POLICY "Users can view tasks in own projects" ON tasks
  FOR SELECT USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can create tasks in own projects" ON tasks
  FOR INSERT WITH CHECK (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can update tasks in own projects" ON tasks
  FOR UPDATE USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can delete tasks in own projects" ON tasks
  FOR DELETE USING (
    project_id IN (SELECT id FROM projects WHERE owner_id = auth.uid())
  );
```

3. Go to Project Settings > API and copy your:
   - Project URL
   - anon/public key
   - service_role key (for server)

### 2. Configure Environment Variables

**Client:**
```bash
cd client
cp .env.example .env
# Edit .env with your Supabase credentials
```

**Server:**
```bash
cd server
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 3. Install Dependencies

```bash
# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

### 4. Run the Application

**Start the server:**
```bash
cd server
npm run dev
```

**Start the client (in another terminal):**
```bash
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Usage

1. Register a new account or login
2. Create a new project
3. Click on a project to open the Kanban board
4. Add tasks using the + button in each column
5. Drag and drop tasks between columns
6. Click on a task to edit details

## Project Structure

```
clickup-clone/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── context/        # React context (auth)
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # Supabase client
│   │   ├── services/       # API layer
│   │   └── types/          # TypeScript types
│   └── ...
│
├── server/                 # Express backend
│   ├── src/
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Auth middleware
│   │   ├── routes/         # API routes
│   │   └── lib/            # Supabase admin client
│   └── ...
│
└── README.md
```

## Quick Start

### 1. Clone and Install
```bash
# Option 1: If you have a GitHub repository
git clone https://github.com/your-username/clickup-clone.git
cd clickup-clone

# Option 2: If starting fresh, initialize git
git init
git add .
git commit -m "Initial commit"

# Install dependencies
cd client && npm install
cd ../server && npm install
```

### 2. Set Up Supabase
1. Create account at [supabase.com](https://supabase.com)
2. Create a new project
3. Run SQL scripts from this README and `ADDITIONAL_SQL.md`
4. Copy your Supabase credentials

### 3. Configure Environment Variables

**Client (`client/.env`):**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**Server (`server/.env`):**
```env
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CORS_ORIGIN=http://localhost:5173
```

### 4. Run Locally
```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

## Deployment

📖 **See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment guide**

### Quick Deploy Options:

**Option 1: Vercel (Frontend) + Railway (Backend)**
- Frontend: Deploy to Vercel (free)
- Backend: Deploy to Railway (free tier available)
- See DEPLOYMENT.md for detailed steps

**Option 2: Netlify (Frontend) + Render (Backend)**
- Frontend: Deploy to Netlify (free)
- Backend: Deploy to Render (free tier available)

**Option 3: Docker**
- Use docker-compose for full stack deployment
- See DEPLOYMENT.md for Docker setup

## Notes

- The frontend communicates directly with Supabase for most operations
- The backend server is optional but useful for complex operations
- RLS policies ensure users can only access their own data
- See `DEPLOYMENT.md` for production deployment instructions
