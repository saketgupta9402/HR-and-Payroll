# Quick Start: PostgreSQL Version

## What Changed

✅ **Removed Supabase completely**
✅ **PostgreSQL database** (Docker)
✅ **Express.js backend API** 
✅ **JWT authentication**
✅ **Redis caching** (optional)

## Run Everything

### Step 1: Start All Services

```bash
docker-compose --profile dev up --build
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)  
- Backend API (port 3001)
- Frontend (port 3000)

### Step 2: Wait for Database

The database will auto-initialize with the schema. Check logs:

```bash
docker-compose logs postgres
```

### Step 3: Access

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## First Time Setup

1. Go to http://localhost:3000
2. Click **"Sign up"**
3. Create your CEO account:
   - Email: `ceo@test.com`
   - Password: `Test123!`
   - Organization details
4. Login and start using!

## Environment Variables

Create `.env` in root (optional - defaults work):

```env
VITE_API_URL=http://localhost:3001
```

Backend uses docker-compose environment variables (already configured).

## API Endpoints

- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/employees` - List employees
- `POST /api/employees` - Create employee
- `POST /api/onboarding/verify-employee-email` - Verify email
- `POST /api/onboarding/setup-password` - Setup password
- `GET /api/profiles/me` - Get profile

## Benefits

✅ **No Edge Functions** - Just REST API endpoints
✅ **Full control** - Your database, your rules
✅ **Easy debugging** - Standard stack
✅ **Better performance** - Direct database access
✅ **Redis caching** - Optional but included

## Troubleshooting

**Database not connecting?**
- Wait for PostgreSQL to fully start
- Check: `docker-compose logs postgres`

**API not starting?**
- Check: `docker-compose logs api`
- Ensure PostgreSQL is healthy first

**CORS errors?**
- API CORS is configured for `http://localhost:3000`
- Check `FRONTEND_URL` env var

---

**Everything should work now without Supabase!** 🎉

