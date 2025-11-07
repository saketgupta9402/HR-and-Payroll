# Quick Start Guide - HR Suite

Since you built this on Lovable.dev, you'll need to set up Supabase. Here are the **easiest options**:

## Option 1: Create a Free Supabase Project (Recommended - Easiest)

### Step 1: Create Supabase Account & Project
1. Go to https://supabase.com
2. Sign up for a free account (if you don't have one)
3. Click "New Project"
4. Fill in:
   - **Name**: HR Suite (or any name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to you
5. Wait 2-3 minutes for project to be created

### Step 2: Get Your Credentials
1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy these two values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)

### Step 3: Create `.env` File
Create a file named `.env` in the project root with:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
```

Replace with your actual values from Step 2.

### Step 4: Set Up Database
You need to run the database migrations. In your Supabase dashboard:
1. Go to **SQL Editor**
2. Click **New Query**
3. Open the file: `supabase/migrations/20251029063529_remix_batch_18_migrations.sql`
4. Copy all its contents
5. Paste into the SQL Editor
6. Click **Run** (or press F5)

### Step 5: Run the App

**With Docker:**
```bash
docker-compose --profile dev up app-dev --build
```

**Without Docker (using Node.js):**
```bash
npm install
npm run dev
```

Access at: **http://localhost:8080** (or http://localhost:3000 if using Docker dev)

---

## Option 2: Use Lovable's Supabase Connection

If your Lovable project is connected to Supabase:

1. **Log into Lovable.dev**
2. Go to your project: https://lovable.dev/projects/314472f0-9de3-4bb2-84ca-b26dd53941cc
3. Check project settings for Supabase connection details
4. Look for environment variables or API settings
5. Copy the Supabase URL and key
6. Create `.env` file with those values
7. Run the app as shown in Option 1, Step 5

---

## Option 3: Run Supabase Locally (Advanced)

If you prefer local Supabase:

### Step 1: Install Supabase CLI
```bash
npm install -g supabase
```

### Step 2: Start Local Supabase
```bash
supabase start
```

This will start Supabase in Docker containers automatically.

### Step 3: Get Local Credentials
```bash
supabase status
```

Copy the API URL and anon key from the output.

### Step 4: Create `.env` File
```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<copy-from-supabase-status>
```

### Step 5: Run Migrations
```bash
supabase db reset
```

This will run all migrations automatically.

### Step 6: Run the App
Follow Step 5 from Option 1 above.

---

## What You Need

✅ **Supabase URL and Key** - Get from one of the options above
✅ **Docker** (if using Docker) - Already have it! ✅
✅ **Node.js** (if not using Docker) - Need to install if you don't have it

---

## Troubleshooting

**"Cannot connect to Supabase"**
- Check your `.env` file has correct values
- Make sure there are no spaces around the `=` sign
- Restart the app after creating/updating `.env`

**"Database errors"**
- Make sure you ran the migrations (Option 1, Step 4)
- Check Supabase project is active (not paused)

**"Port already in use"**
- Change port in `vite.config.ts` or `docker-compose.yml`

---

## Next Steps

Once running:
1. Go to http://localhost:8080
2. Sign up as a CEO to create your organization
3. Start using the HR Suite!

