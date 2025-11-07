# Payroll Integration - Quick Start Guide

The Payroll application has been integrated with the HR system. Here's how to use it:

## ✅ What's Been Done

1. ✅ **Payroll app cloned** to `payroll-app/` directory
2. ✅ **SSO middleware added** to Payroll backend
3. ✅ **SSO routes added** to Payroll backend
4. ✅ **Auto-provisioning service** added to Payroll backend
5. ✅ **Payroll services added** to docker-compose.yml
6. ✅ **Payroll link added** to HR sidebar

## 🚀 Quick Start

### Step 1: Start All Services

```bash
docker-compose --profile dev up --build
```

This starts:
- **HR System**: http://localhost:3000
- **HR API**: http://localhost:3001
- **Payroll App**: http://localhost:3002
- **Payroll API**: http://localhost:4000
- **HR DB**: PostgreSQL on port 5432
- **Payroll DB**: PostgreSQL on port 5433

### Step 2: Run Payroll Migrations

The Payroll database needs HR integration columns. Run:

```bash
# Option 1: Via Docker (if migrations are in docker-entrypoint-initdb.d)
docker exec -it petal-hr-suite-16029-payroll-db-1 psql -U postgres -d payroll -f /docker-entrypoint-initdb.d/001_add_hr_integration.sql

# Option 2: Manual connection
psql -h localhost -p 5433 -U postgres -d payroll -f payroll-integration/migrations/001_add_hr_integration.sql
psql -h localhost -p 5433 -U postgres -d payroll -f payroll-integration/migrations/002_add_org_scoping.sql
```

### Step 3: Set Environment Variables

**HR System (.env):**
```env
PAYROLL_INTEGRATION_ENABLED=true
PAYROLL_BASE_URL=http://localhost:3002
PAYROLL_JWT_SECRET=your-shared-secret-key
```

**Payroll Backend (payroll-app/.env):**
```env
HR_JWT_SECRET=your-shared-secret-key  # Must match HR's PAYROLL_JWT_SECRET
DATABASE_URL=postgresql://postgres:mysecretpassword@localhost:5433/payroll
JWT_SECRET=dev_secret
PORT=4000
```

**Payroll Frontend (payroll-app/.env):**
```env
VITE_API_URL=http://localhost:4000
```

### Step 4: Test SSO

1. Login to HR: http://localhost:3000
2. Click **"Payroll"** in sidebar
3. Payroll app opens in new tab
4. Should automatically log you in
5. Redirects to dashboard based on role

## 📋 Services

### HR System
- Frontend: http://localhost:3000
- API: http://localhost:3001
- Database: PostgreSQL on port 5432

### Payroll System
- Frontend: http://localhost:3002
- API: http://localhost:4000
- Database: PostgreSQL on port 5433

## 🔧 Troubleshooting

### Payroll Link Not Showing

1. Check `PAYROLL_INTEGRATION_ENABLED=true` in HR environment
2. Verify user role (HR, Admin, CEO, or Accountant)
3. Refresh browser

### SSO Not Working

1. **Check JWT secrets match:**
   - HR: `PAYROLL_JWT_SECRET`
   - Payroll: `HR_JWT_SECRET`
   - They must be the same!

2. **Check Payroll API is running:**
   ```bash
   docker ps | grep payroll
   docker logs petal-hr-suite-16029-payroll-api-1
   ```

3. **Check Payroll database:**
   ```bash
   docker logs petal-hr-suite-16029-payroll-db-1
   ```

### User Not Auto-Provisioned

1. Check Payroll database has `hr_user_id`, `org_id`, `payroll_role` columns
2. Run migrations if missing
3. Check Payroll API logs for errors

### Payroll App Not Loading

1. Check Payroll frontend is running: `docker ps | grep payroll-app`
2. Check logs: `docker logs petal-hr-suite-16029-payroll-app-1`
3. Verify port 3002 is not in use

## 📁 Files Added/Modified

### HR System
- `docker-compose.yml` - Added Payroll services
- `server/routes/payroll-sso.js` - SSO endpoint (already existed)
- `src/components/layout/AppSidebar.tsx` - Payroll link (already existed)

### Payroll App (New)
- `payroll-app/server/src/middleware/sso.ts` - JWT verification
- `payroll-app/server/src/middleware/rbac.ts` - RBAC guards
- `payroll-app/server/src/services/user-service.ts` - Auto-provisioning
- `payroll-app/server/src/routes/sso.ts` - SSO handler

### Payroll App (Modified)
- `payroll-app/server/src/index.ts` - Added SSO routes
- `payroll-app/src/App.tsx` - Added `/sso` route
- `payroll-app/src/pages/Index.tsx` - Added SSO token detection

## 🎯 Next Steps

1. **Run Migrations**: Execute Payroll migrations
2. **Set Secrets**: Configure `PAYROLL_JWT_SECRET` and `HR_JWT_SECRET`
3. **Test SSO**: Login to HR and click Payroll link
4. **Backfill Data**: Run ETL script to link existing Payroll users

## 📚 Documentation

- **Integration Guide**: `PAYROLL_APP_INTEGRATION.md`
- **Payroll Implementation**: `payroll-integration/PAYROLL_IMPLEMENTATION.md`
- **Schema Mapping**: `docs/schema-mapping.md`

## 🎉 Status

**Payroll app is integrated!** You can now:
- Click "Payroll" in HR sidebar
- Automatically log in to Payroll
- Access Payroll features based on your role




