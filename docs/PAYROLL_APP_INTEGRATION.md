# Payroll App Integration - Complete Guide

The Payroll application from https://github.com/saketgupta9402/payroll.git has been integrated with the HR system via SSO.

## Integration Overview

The Payroll app runs as a **separate service** alongside the HR system, connected via Single Sign-On (SSO).

### Architecture

```
HR System (http://localhost:3000)
    ↓
  SSO JWT Token
    ↓
Payroll App (http://localhost:3002)
    ↓
  Payroll API (http://localhost:4000)
    ↓
  Payroll DB (PostgreSQL on port 5433)
```

## What Was Integrated

### 1. Payroll Backend (SSO Integration) ✅

**Files Added:**
- `payroll-app/server/src/middleware/sso.ts` - JWT verification middleware
- `payroll-app/server/src/middleware/rbac.ts` - RBAC guards
- `payroll-app/server/src/services/user-service.ts` - Auto-provisioning service
- `payroll-app/server/src/routes/sso.ts` - SSO route handler

**Changes:**
- Updated `payroll-app/server/src/index.ts` to register SSO routes
- SSO endpoint: `GET /sso?token=<jwt>`
- Auto-provisions users from HR system
- Sets session cookie for Payroll app

### 2. Payroll Frontend (SSO Handling) ✅

**Files Modified:**
- `payroll-app/src/App.tsx` - Added `/sso` route
- `payroll-app/src/pages/Index.tsx` - Added SSO token detection

**Changes:**
- Detects SSO token in URL
- Redirects to backend SSO handler
- Backend handles token verification and redirects to dashboard

### 3. Docker Compose Integration ✅

**Services Added:**
- `payroll-api` - Payroll backend API (port 4000)
- `payroll-db` - Payroll PostgreSQL database (port 5433)
- `payroll-redis` - Payroll Redis cache (port 6380)
- `payroll-app` - Payroll frontend (port 3002)

**Environment Variables:**
- `HR_JWT_SECRET` - Must match HR's `PAYROLL_JWT_SECRET`
- `PAYROLL_BASE_URL` - Payroll frontend URL
- `HR_BASE_URL` - HR system URL

### 4. HR System Integration ✅

**Files Modified:**
- `server/routes/payroll-sso.js` - SSO endpoint (already implemented)
- `src/components/layout/AppSidebar.tsx` - Payroll link (already added)
- `docker-compose.yml` - Added Payroll services

## How It Works

### SSO Flow

1. **User clicks "Payroll" in HR sidebar**
   - HR frontend calls `/api/payroll/sso`
   - HR backend generates JWT with user claims

2. **HR frontend opens Payroll URL**
   - Opens: `http://localhost:3002/sso?token=<jwt>`
   - Opens in new tab

3. **Payroll backend verifies token**
   - Payroll `/sso` endpoint receives token
   - Verifies JWT signature using shared secret
   - Extracts user claims (hr_user_id, org_id, email, roles)

4. **Payroll backend auto-provisions user**
   - Creates/updates Payroll user in database
   - Links by `hr_user_id` or email
   - Sets `payroll_role` based on HR roles

5. **Payroll backend sets session**
   - Sets JWT cookie for Payroll app
   - Redirects to dashboard based on role:
     - `payroll_admin` → `/dashboard`
     - `payroll_employee` → `/employee-portal`

6. **User is logged in**
   - Cookie set automatically
   - No signup/login required

## Running the Integration

### Step 1: Start All Services

```bash
docker-compose --profile dev up --build
```

This starts:
- HR PostgreSQL (port 5432)
- HR API (port 3001)
- HR Frontend (port 3000)
- Payroll PostgreSQL (port 5433)
- Payroll API (port 4000)
- Payroll Frontend (port 3002)
- Redis (port 6379 for HR, 6380 for Payroll)

### Step 2: Run Payroll Migrations

The Payroll database needs to have HR integration columns. Run:

```bash
# Connect to Payroll database
psql -h localhost -p 5433 -U postgres -d payroll

# Run migrations
\i payroll-integration/migrations/001_add_hr_integration.sql
\i payroll-integration/migrations/002_add_org_scoping.sql
```

Or let it run automatically via docker-entrypoint-initdb.d (if configured).

### Step 3: Configure Environment Variables

**HR System (.env):**
```env
PAYROLL_INTEGRATION_ENABLED=true
PAYROLL_BASE_URL=http://localhost:3002
PAYROLL_JWT_SECRET=your-shared-secret-key
```

**Payroll App (.env in payroll-app/):**
```env
HR_JWT_SECRET=your-shared-secret-key  # Must match HR's PAYROLL_JWT_SECRET
DATABASE_URL=postgresql://postgres:mysecretpassword@localhost:5433/payroll
REDIS_URL=redis://localhost:6380
JWT_SECRET=dev_secret
PORT=4000
```

**Payroll Frontend (.env in payroll-app/):**
```env
VITE_API_URL=http://localhost:4000
VITE_PAYROLL_BASE_URL=http://localhost:3002
```

### Step 4: Test SSO Flow

1. Login to HR system: http://localhost:3000
2. Click "Payroll" in sidebar
3. Should open Payroll app in new tab
4. Should automatically log you in
5. Should redirect to appropriate dashboard

## Database Setup

### Payroll Database Schema

The Payroll database needs these columns in the `users` table:

```sql
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS hr_user_id UUID,
ADD COLUMN IF NOT EXISTS org_id UUID,
ADD COLUMN IF NOT EXISTS payroll_role VARCHAR(50) CHECK (payroll_role IN ('payroll_admin', 'payroll_employee'));
```

See `payroll-integration/migrations/001_add_hr_integration.sql` for full migration.

### Running Migrations

**Option 1: Manual**
```bash
psql -h localhost -p 5433 -U postgres -d payroll -f payroll-integration/migrations/001_add_hr_integration.sql
psql -h localhost -p 5433 -U postgres -d payroll -f payroll-integration/migrations/002_add_org_scoping.sql
```

**Option 2: Via Docker (auto-run on first start)**
Copy migrations to `payroll-integration/migrations/` and they'll run automatically when the database starts.

## Troubleshooting

### Payroll Link Not Showing

1. Check `PAYROLL_INTEGRATION_ENABLED=true` in HR environment
2. Verify user role is HR, Admin, CEO, or Accountant
3. Check browser console for errors
4. Refresh page

### SSO Token Invalid

1. Verify `PAYROLL_JWT_SECRET` in HR matches `HR_JWT_SECRET` in Payroll
2. Check token hasn't expired (5 minute expiry)
3. Check Payroll API logs for verification errors

### User Not Auto-Provisioned

1. Check Payroll database connection
2. Verify migrations have been run
3. Check Payroll API logs for errors
4. Verify `users` table has `hr_user_id`, `org_id`, `payroll_role` columns

### Payroll App Not Starting

1. Check Docker containers: `docker ps`
2. Check Payroll API logs: `docker logs petal-hr-suite-16029-payroll-api-1`
3. Check Payroll DB is running: `docker logs petal-hr-suite-16029-payroll-db-1`
4. Verify ports are not in use: `netstat -an | grep -E "3002|4000|5433"`

## API Endpoints

### HR System

- `GET /api/payroll/sso` - Generate SSO token (requires HR auth)
- Returns: `{ redirectUrl, token, expiresIn, payrollRole }`

### Payroll System

- `GET /sso?token=<jwt>` - SSO endpoint (public, verifies JWT)
- `GET /sso/verify?token=<jwt>` - Verify token (for debugging)
- `POST /sso/logout` - Logout (clears session)

## Files Created/Modified

### HR System
- `docker-compose.yml` - Added Payroll services
- `server/routes/payroll-sso.js` - SSO endpoint (already existed)
- `src/components/layout/AppSidebar.tsx` - Payroll link (already existed)

### Payroll App (New Files)
- `payroll-app/server/src/middleware/sso.ts` - JWT verification
- `payroll-app/server/src/middleware/rbac.ts` - RBAC guards
- `payroll-app/server/src/services/user-service.ts` - Auto-provisioning
- `payroll-app/server/src/routes/sso.ts` - SSO handler

### Payroll App (Modified Files)
- `payroll-app/server/src/index.ts` - Added SSO routes
- `payroll-app/src/App.tsx` - Added `/sso` route
- `payroll-app/src/pages/Index.tsx` - Added SSO token detection

## Next Steps

1. **Run Migrations**: Execute Payroll migrations to add HR integration columns
2. **Configure Secrets**: Set `PAYROLL_JWT_SECRET` and `HR_JWT_SECRET` to same value
3. **Test SSO**: Login to HR and click Payroll link
4. **Backfill Data**: Run ETL script to link existing Payroll users to HR users
5. **Verify Integrity**: Run verification script to check data integrity

## Support

For issues:
1. Check logs: `docker logs <container-name>`
2. Verify environment variables match
3. Check database migrations are applied
4. Verify JWT secrets match

See `payroll-integration/README.md` for more details.




