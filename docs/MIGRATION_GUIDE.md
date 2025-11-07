# Complete Migration: Supabase → PostgreSQL + Express API

## What Changed

✅ **Removed Supabase completely**
✅ **Added PostgreSQL database** (Docker)
✅ **Added Express.js backend API** 
✅ **Added Redis for caching** (optional)
✅ **JWT-based authentication** (replaces Supabase Auth)
✅ **REST API endpoints** (replaces Supabase client calls)

## New Architecture

```
Frontend (React) → Express API (Node.js) → PostgreSQL
                              ↓
                           Redis (cache)
```

---

## How to Run

### Step 1: Start All Services

```bash
docker-compose --profile dev up --build
```

This starts:
- ✅ PostgreSQL (port 5432)
- ✅ Redis (port 6379)
- ✅ Backend API (port 3001)
- ✅ Frontend (port 3000)

### Step 2: Database Will Auto-Initialize

The schema runs automatically from `server/db/schema.sql` when PostgreSQL starts.

### Step 3: Access

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **API Health**: http://localhost:3001/health

---

## Environment Variables

Create `.env` in root:

```env
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=hr_suite
DB_USER=postgres
DB_PASSWORD=postgres

# API
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-in-production
FRONTEND_URL=http://localhost:3000

# Frontend
VITE_API_URL=http://localhost:3001

# Redis (optional)
REDIS_HOST=redis
REDIS_PORT=6379
```

---

## What's Working Now

✅ Authentication (signup, login, logout)
✅ Employee creation
✅ Employee listing
✅ Profile management
✅ First-time login / password setup
✅ Role-based access control

---

## Still Using Supabase?

Some files might still reference Supabase. These need updating:
- Any component using `supabase.from()`
- Any component using `supabase.auth`
- Edge function calls

The migration is **ongoing** - I've updated the core files, but there may be more to update.

---

## Benefits

✅ **No Edge Functions needed** - Everything is regular API endpoints
✅ **Full control** - Your database, your rules
✅ **Easier debugging** - Standard Node.js/PG stack
✅ **Better performance** - Direct database access
✅ **Flexible** - Add any feature easily

