# 🚀 Quick Start Guide

Get your ClickUp Clone running in 5 minutes!

## Step 1: Prerequisites ✅

Make sure you have:
- Node.js 18+ installed ([Download](https://nodejs.org/))
- npm or yarn
- A Supabase account ([Sign up free](https://supabase.com))

## Step 2: Clone & Install 📦

```bash
# Option 1: Clone from GitHub (if you have a repository)
git clone https://github.com/your-username/clickup-clone.git
cd clickup-clone

# Option 2: If you're starting fresh locally
# Just navigate to your project directory
cd clickup-clone

# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

## Step 3: Set Up Supabase 🔧

1. **Create Supabase Project:**
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Fill in project details
   - Wait ~2 minutes for setup

2. **Get Your Credentials:**
   - Go to **Project Settings > API**
   - Copy:
     - **Project URL** (looks like: `https://xxxxx.supabase.co`)
     - **anon/public key** (long string starting with `eyJ...`)
     - **service_role key** (keep this secret!)

3. **Run Database Setup:**
   - Go to **SQL Editor** in Supabase
   - Copy and run ALL SQL from `README.md` (lines 37-99)
   - Copy and run ALL SQL from `ADDITIONAL_SQL.md`
   - Wait for "Success" message

## Step 4: Configure Environment Variables 🔐

### Client Configuration

Create `client/.env` file:
```bash
cd client
touch .env
```

Add this content (replace with your Supabase values):
```env
# Get these from Supabase Dashboard > Project Settings > API
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### Server Configuration

Create `server/.env` file:
```bash
cd server
touch .env
```

Add this content (replace with your Supabase values):
```env
PORT=3000
# Get these from Supabase Dashboard > Project Settings > API
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
CORS_ORIGIN=http://localhost:5173
```

## Step 5: Run the Application 🎉

### Terminal 1 - Start Backend:
```bash
cd server
npm run dev
```
You should see: `Server running on port 3000`

### Terminal 2 - Start Frontend:
```bash
cd client
npm run dev
```
You should see: `Local: http://localhost:5173`

## Step 6: Open in Browser 🌐

Open [http://localhost:5173](http://localhost:5173)

You should see the login page!

## Step 7: Create Your First Account 👤

1. Click "Register" or "Sign Up"
2. Enter your email and password
3. Check your email for confirmation (if required)
4. Login with your credentials

## Step 8: Test the App ✅

1. **Create a Project:**
   - Click "Projects" in sidebar
   - Click "New Project"
   - Enter name and description
   - Click "Create"

2. **Add Tasks:**
   - Click on your project
   - Click "+" button in any column
   - Fill in task details
   - Click "Create Task"

3. **Try Features:**
   - Drag and drop tasks between columns
   - Click on a task to edit
   - Add comments and tags
   - Use search (Cmd/Ctrl + K)

## 🎊 You're Done!

Your ClickUp Clone is now running locally!

---

## Next Steps

- **Deploy to Production:** See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Customize:** Edit components in `client/src/components/`
- **Add Features:** Check existing code structure

## Troubleshooting

### "Cannot connect to Supabase"
- ✅ Check `.env` files exist and have correct values
- ✅ Verify Supabase project is active
- ✅ Check browser console for errors

### "Database errors"
- ✅ Make sure you ran ALL SQL scripts
- ✅ Check Supabase Table Editor for tables
- ✅ Verify RLS policies are enabled

### "Port already in use"
- ✅ Change port in `server/.env` (PORT=3001)
- ✅ Or kill process using port: `lsof -ti:3000 | xargs kill`

### "Module not found"
- ✅ Delete `node_modules` and `package-lock.json`
- ✅ Run `npm install` again
- ✅ Check Node.js version: `node --version` (should be 18+)

---

## Need Help?

1. Check [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions
2. Review Supabase documentation
3. Check application logs in terminal
4. Review browser console for errors

Happy coding! 🚀

