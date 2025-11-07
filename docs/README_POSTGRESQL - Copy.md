# HR Suite - PostgreSQL Version

## Complete Migration from Supabase to PostgreSQL

This version uses **PostgreSQL** + **Express.js API** instead of Supabase. No Edge Functions needed!

---

## 🚀 Quick Start

### 1. Start Everything

```bash
docker-compose --profile dev up --build
```

This starts:
- **PostgreSQL** (port 5432) - Database
- **Redis** (port 6379) - Caching (optional)
- **Backend API** (port 3001) - Express.js server
- **Frontend** (port 3000) - React app

### 2. Wait for Database

The database auto-initializes with the schema. Wait about 10 seconds for PostgreSQL to be ready.

### 3. Access the App

Open: **http://localhost:3000**

- First time? Click **"Sign up"** to create a CEO account

---

## 📁 Project Structure

```
├── server/              # Backend API (Express.js)
│   ├── db/
│   │   ├── pool.js      # PostgreSQL connection pool
│   │   └── full-schema.sql  # Database schema
│   ├── routes/          # API routes
│   │   ├── auth.js      # Authentication
│   │   ├── employees.js # Employee management
│   │   └── profiles.js  # User profiles
│   └── middleware/
│       └── auth.js      # JWT authentication
├── src/                 # Frontend (React)
│   ├── lib/
│   │   └── api.ts       # API client (replaces Supabase)
│   └── contexts/
│       └── AuthContext.tsx  # Auth (uses API)
└── docker-compose.yml   # All services
```

---

## 🔑 Key Changes from Supabase

### Before (Supabase)
```typescript
import { supabase } from '@/integrations/supabase/client';
const { data } = await supabase.from('employees').select('*');
```

### After (PostgreSQL API)
```typescript
import { api } from '@/lib/api';
const data = await api.getEmployees();
```

### Authentication

**Before:**
- Supabase Auth with Edge Functions

**After:**
- JWT tokens stored in localStorage
- Standard REST API endpoints
- No Edge Functions needed!

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/employees` | List employees |
| POST | `/api/employees` | Create employee |
| POST | `/api/onboarding/verify-employee-email` | Verify email |
| POST | `/api/onboarding/setup-password` | Setup password |
| GET | `/api/profiles/me` | Get profile |

---

## 🔧 Configuration

### Environment Variables

Create `.env` in root (optional):

```env
VITE_API_URL=http://localhost:3001
```

Backend uses Docker Compose env vars (already configured in `docker-compose.yml`).

### Database Connection

Default PostgreSQL connection:
- Host: `postgres` (in Docker) or `localhost` (local)
- Port: `5432`
- Database: `hr_suite`
- User: `postgres`
- Password: `postgres`

---

## 🐛 Troubleshooting

### Database Not Connecting

```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres psql -U postgres -d hr_suite -c "SELECT NOW();"
```

### API Not Starting

```bash
# Check API logs
docker-compose logs api

# Ensure PostgreSQL is healthy first
docker-compose ps
```

### CORS Errors

- API CORS is configured for `http://localhost:3000`
- Check `FRONTEND_URL` in docker-compose.yml

### Reset Everything

```bash
# Stop and remove all containers/volumes
docker-compose --profile dev down -v

# Start fresh
docker-compose --profile dev up --build
```

---

## ✨ Benefits

✅ **No Supabase dependency**
✅ **No Edge Functions** - Just REST endpoints
✅ **Full database control**
✅ **Easier debugging** - Standard Node.js/PG
✅ **Better performance** - Direct DB access
✅ **Redis caching** included
✅ **Standard stack** - Easy to understand

---

## 📝 Next Steps

1. ✅ Core auth working
2. ✅ Employee management working
3. ⏳ Add more API routes as needed
4. ⏳ Add Redis caching for queries
5. ⏳ Add more features (leave requests, timesheets, etc.)

---

**Everything works with standard PostgreSQL now!** 🎉

