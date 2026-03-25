# Deployment Guide

Complete guide to set up and deploy the ClickUp Clone application.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Repository Setup](#repository-setup)
3. [Local Setup](#local-setup)
4. [Environment Variables](#environment-variables)
5. [Database Setup](#database-setup)
6. [Deployment Options](#deployment-options)
   - [Vercel (Frontend) + Railway/Render (Backend)](#vercel--railwayrender)
   - [Netlify (Frontend) + Railway/Render (Backend)](#netlify--railwayrender)
   - [Full Stack on Railway](#full-stack-on-railway)
   - [Docker Deployment](#docker-deployment)

---

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Git installed
- Supabase account (free tier works)
- GitHub account (for deployment)

---

## Repository Setup

Before deploying, you need to push your code to a Git repository (GitHub, GitLab, or Bitbucket).

### Create GitHub Repository

1. Go to [github.com](https://github.com) and sign in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Repository name: `clickup-clone` (or your preferred name)
4. Choose **Public** or **Private**
5. **Don't** check "Initialize with README" (we already have files)
6. Click **"Create repository"**

### Push Your Code

```bash
# If git is not initialized
git init
git add .
git commit -m "Initial commit: ClickUp Clone project"

# Add your GitHub repository
git remote add origin https://github.com/YOUR_USERNAME/clickup-clone.git
git branch -M main
git push -u origin main
```

**Replace `YOUR_USERNAME` with your actual GitHub username.**

---

## Local Setup

### Step 1: Clone or Set Up Repository

**If cloning an existing repository:**

```bash
# Replace with your actual repository URL
git clone https://github.com/your-username/clickup-clone.git
cd clickup-clone
```

**If starting fresh locally:**

```bash
# Navigate to your project directory
cd clickup-clone
```

### Step 2: Install Dependencies

```bash
# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

### Step 3: Create Environment Files

**Client (.env):**
```bash
cd client
touch .env
```

Add the following:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Server (.env):**
```bash
cd server
touch .env
```

Add the following:
```env
PORT=3000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
CORS_ORIGIN=http://localhost:5173
```

### Step 4: Run Locally

**Terminal 1 - Start Server:**
```bash
cd server
npm run dev
```

**Terminal 2 - Start Client:**
```bash
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Environment Variables

### Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be ready (takes ~2 minutes)
3. Go to **Project Settings > API**
4. Copy:
   - **Project URL** → Use for `VITE_SUPABASE_URL` and `SUPABASE_URL`
   - **anon/public key** → Use for `VITE_SUPABASE_ANON_KEY`
   - **service_role key** → Use for `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

### Environment Variables Reference

**Client (.env):**
- `VITE_SUPABASE_URL` - Your Supabase project URL (format: `https://xxxxx.supabase.co`)
  - Get from: Supabase Dashboard > Project Settings > API > Project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key (starts with `eyJ...`)
  - Get from: Supabase Dashboard > Project Settings > API > anon/public key

**Server (.env):**
- `PORT` - Server port (default: 3000)
- `SUPABASE_URL` - Your Supabase project URL (format: `https://xxxxx.supabase.co`)
  - Get from: Supabase Dashboard > Project Settings > API > Project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (secret! starts with `eyJ...`)
  - Get from: Supabase Dashboard > Project Settings > API > service_role key
  - ⚠️ **Keep this secret!** Never commit it to Git.
- `CORS_ORIGIN` - Allowed CORS origins (comma-separated for production)
  - Local: `http://localhost:5173`
  - Production: Your frontend deployment URL (e.g., `https://clickup-clone.vercel.app`)

---

## Database Setup

### Step 1: Run Initial SQL

1. Go to Supabase Dashboard > SQL Editor
2. Run the SQL from `README.md` (lines 37-99) to create basic tables

### Step 2: Run Additional SQL

1. Go to Supabase Dashboard > SQL Editor
2. Run all SQL from `ADDITIONAL_SQL.md` to add:
   - Spaces, Folders, Lists tables
   - Comments table
   - Activities table
   - Team members table
   - Tags support
   - Sprints table

### Step 3: Verify Tables

Go to **Table Editor** in Supabase and verify these tables exist:
- `projects`
- `tasks`
- `spaces`
- `folders`
- `lists`
- `comments`
- `activities`
- `team_members`
- `sprints`

---

## Deployment Options

### Option 1: Vercel (Frontend) + Railway/Render (Backend)

#### Deploy Frontend to Vercel

1. **Push code to GitHub:**
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click "New Project"
   - Import your repository
   - Set root directory to `client`
   - Configure build settings:
     - **Framework Preset:** Vite
     - **Build Command:** `npm run build`
     - **Output Directory:** `dist`
     - **Install Command:** `npm install`

3. **Add Environment Variables in Vercel:**
   - Go to Project Settings > Environment Variables
   - Add:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

4. **Deploy:**
   - Click "Deploy"
   - Wait for deployment to complete
   - Copy the deployment URL (e.g., `https://clickup-clone.vercel.app`)
   - **Note:** Replace `your-app` with your actual Vercel project name

#### Deploy Backend to Railway

1. **Go to [railway.app](https://railway.app)**
   - Sign in with GitHub
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Set root directory to `server`

2. **Configure Railway:**
   - Railway will auto-detect Node.js
   - Add environment variables:
     - `PORT` = `3000`
     - `SUPABASE_URL` = your Supabase URL
     - `SUPABASE_SERVICE_ROLE_KEY` = your service role key
     - `CORS_ORIGIN` = your Vercel URL (e.g., `https://clickup-clone.vercel.app`)
     - **Note:** Replace with your actual Vercel deployment URL

3. **Deploy:**
   - Railway will automatically deploy
   - Copy the Railway URL (e.g., `https://clickup-clone-api.up.railway.app`)
   - **Note:** Replace with your actual Railway deployment URL

4. **Update Vercel Environment Variables:**
   - Add `VITE_API_URL` = your Railway URL
   - Redeploy Vercel app

#### Alternative: Deploy Backend to Render

1. **Go to [render.com](https://render.com)**
   - Sign in with GitHub
   - Click "New +" > "Web Service"
   - Connect your repository
   - Configure:
     - **Name:** clickup-clone-api
     - **Root Directory:** `server`
     - **Environment:** Node
     - **Build Command:** `npm install && npm run build`
     - **Start Command:** `npm start`

2. **Add Environment Variables:**
   - `PORT` = `3000`
   - `SUPABASE_URL` = your Supabase URL
   - `SUPABASE_SERVICE_ROLE_KEY` = your service role key
   - `CORS_ORIGIN` = your Vercel URL

3. **Deploy:**
   - Click "Create Web Service"
   - Wait for deployment
   - Copy the Render URL

---

### Option 2: Netlify (Frontend) + Railway/Render (Backend)

#### Deploy Frontend to Netlify

1. **Push code to GitHub** (if not done)

2. **Go to [netlify.com](https://netlify.com)**
   - Sign in with GitHub
   - Click "Add new site" > "Import an existing project"
   - Select your repository

3. **Configure Build Settings:**
   - **Base directory:** `client`
   - **Build command:** `npm run build`
   - **Publish directory:** `client/dist`

4. **Add Environment Variables:**
   - Go to Site Settings > Environment Variables
   - Add:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

5. **Deploy:**
   - Click "Deploy site"
   - Copy the Netlify URL (e.g., `https://clickup-clone.netlify.app`)
   - **Note:** Replace with your actual Netlify deployment URL

6. **Update Backend CORS_ORIGIN** with Netlify URL

---

### Option 3: Full Stack on Railway

Deploy both frontend and backend on Railway:

1. **Create Two Services on Railway:**

   **Service 1 - Frontend:**
   - Root directory: `client`
   - Build command: `npm run build`
   - Start command: `npm run preview` (or use Vite preview)
   - Add environment variables:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

   **Service 2 - Backend:**
   - Root directory: `server`
   - Build command: `npm run build`
   - Start command: `npm start`
   - Add environment variables:
     - `PORT` = `3000`
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `CORS_ORIGIN` = Frontend Railway URL

2. **Configure Railway:**
   - Both services will get URLs
   - Update frontend environment variables with backend URL
   - Redeploy frontend

---

### Option 4: Docker Deployment

#### Create Dockerfile for Client

Create `client/Dockerfile`:
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `client/nginx.conf`:
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### Create Dockerfile for Server

Create `server/Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

#### Create docker-compose.yml

Create `docker-compose.yml` in root:
```yaml
version: '3.8'

services:
  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    ports:
      - "80:80"
    environment:
      - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
    restart: unless-stopped

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - CORS_ORIGIN=http://localhost
    restart: unless-stopped
```

#### Deploy with Docker

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## Post-Deployment Checklist

- [ ] All environment variables are set correctly
- [ ] Database tables are created (run SQL scripts)
- [ ] CORS is configured correctly (backend allows frontend URL)
- [ ] Frontend can connect to Supabase
- [ ] Backend can connect to Supabase
- [ ] Authentication works (register/login)
- [ ] Can create projects and tasks
- [ ] All features are working

---

## Troubleshooting

### Frontend won't connect to Supabase
- Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Ensure environment variables are set in deployment platform
- Check browser console for errors

### Backend CORS errors
- Verify `CORS_ORIGIN` includes your frontend URL
- Check backend logs for CORS errors
- Ensure backend is running and accessible

### Database errors
- Verify all SQL scripts have been run
- Check Supabase dashboard for table existence
- Verify RLS policies are set correctly

### Build failures
- Check Node.js version (needs 18+)
- Verify all dependencies are installed
- Check build logs for specific errors

---

## Production Tips

1. **Use Environment-Specific Variables:**
   - Development: `localhost` URLs
   - Production: Deployed URLs

2. **Enable Supabase Row Level Security:**
   - All tables should have RLS enabled
   - Policies should be restrictive

3. **Monitor Your Application:**
   - Set up error tracking (Sentry, LogRocket)
   - Monitor Supabase usage
   - Set up uptime monitoring

4. **Security:**
   - Never commit `.env` files
   - Use environment variables in deployment platforms
   - Keep service role key secret
   - Use HTTPS in production

5. **Performance:**
   - Enable Supabase caching
   - Use CDN for static assets
   - Optimize images and assets

---

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Supabase documentation
3. Check deployment platform documentation
4. Review application logs

---

## Quick Deploy Commands

### Vercel (Frontend)
```bash
cd client
npm install -g vercel
vercel
```

### Railway (Backend)
```bash
cd server
npm install -g @railway/cli
railway login
railway init
railway up
```

### Netlify (Frontend)
```bash
cd client
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

