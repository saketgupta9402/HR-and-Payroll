# SSO Endpoint Fix Guide

## Issue
The SSO endpoint at `http://localhost:4000/sso?token=...` was returning `ERR_EMPTY_RESPONSE` error.

## Root Causes Identified

### 1. Database Column Mismatch (FIXED)
The Payroll app was trying to query `e.date_of_joining` from the `employees` table, but the HR database uses `join_date` instead. This was causing the server to crash when processing other requests.

**Fix Applied:**
- Updated query in `payroll-app/server/src/routes/app.ts` line 1915-1929 to use `payroll_employee_view` instead of directly joining with `employees` table
- The view maps `join_date` to `date_of_joining` correctly

### 2. Missing RSA Keys (NEEDS SETUP)
The SSO endpoint requires RSA key pair for JWT signing/verification:
- HR System needs: `HR_PAYROLL_JWT_PRIVATE_KEY`
- Payroll System needs: `HR_PAYROLL_JWT_PUBLIC_KEY`

## Setup Instructions

### Step 1: Generate RSA Key Pair

Run the key generation script:
```bash
node scripts/generate-rsa-keys.js
```

This will:
- Generate a new RSA-256 key pair
- Save keys to `.keys/` directory
- Display the keys for you to add to your `.env` file

### Step 2: Add Keys to Environment Variables

**For HR System (.env in root):**
```env
HR_PAYROLL_JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**For Payroll System (docker-compose.yml or .env):**
```env
HR_PAYROLL_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
```

### Step 3: Restart Services

After adding the keys, restart the Payroll API:
```bash
docker-compose restart payroll-api
```

Or if running locally:
```bash
cd payroll-app/server
npm run dev
```

### Step 4: Test SSO Endpoint

Test the SSO endpoint:
```bash
# Get a token from HR system first
curl "http://localhost:4000/sso?token=YOUR_JWT_TOKEN"
```

## Current Status

✅ **Database query fixed** - Server should no longer crash on `/api/payroll/new-cycle-data`
✅ **SSO endpoint working** - Logs show SSO is processing successfully
⚠️ **RSA keys needed** - Add keys to environment variables for production use

## Verification

Check Payroll API logs:
```bash
docker logs petal-hr-suite-16029-payroll-api-1 --tail 50
```

You should see:
- ✅ SSO token verified messages
- ✅ No database column errors
- ✅ Server running without crashes

## Troubleshooting

### Still getting ERR_EMPTY_RESPONSE?

1. **Check if server is running:**
   ```bash
   docker ps | grep payroll-api
   ```

2. **Check server logs for errors:**
   ```bash
   docker logs petal-hr-suite-16029-payroll-api-1 --tail 100
   ```

3. **Verify environment variables:**
   ```bash
   docker exec petal-hr-suite-16029-payroll-api-1 env | grep HR_PAYROLL_JWT
   ```

4. **Test health endpoint:**
   ```bash
   curl http://localhost:4000/health
   ```

### Server crashing?

- Check database connection
- Verify `payroll_employee_view` exists in database
- Check all queries use correct column names

### SSO token verification failing?

- Verify `HR_PAYROLL_JWT_PUBLIC_KEY` is set in Payroll system
- Verify `HR_PAYROLL_JWT_PRIVATE_KEY` is set in HR system
- Ensure keys are properly formatted with `\n` for newlines
- Check token hasn't expired (5 minute expiry)

