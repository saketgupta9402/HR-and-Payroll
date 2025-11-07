# Multi-Tenant Implementation Summary

This document summarizes the multi-tenant implementation with RLS, policies, promotion cycles, and email invites.

## Overview

Implemented a comprehensive multi-tenant HR system with:
- Row-Level Security (RLS) for tenant isolation
- Organization slug-based routing (subdomain or path)
- Dynamic policy management with employee overrides
- Promotion cycle management
- Email-based invite system for first-time login
- Tenant-safe database reset functionality

## Database Schema

### New Tables

1. **policy_catalog** - Catalog of available policies
   - `id`, `key` (unique), `display_name`, `category`, `description`, `value_type` (STRING/NUMBER/BOOLEAN/JSON)

2. **org_policies** - Organization-level policies
   - `id`, `org_id`, `policy_key`, `value` (JSONB), `effective_from`, `effective_to`

3. **employee_policies** - Employee-specific policy overrides
   - `id`, `user_id`, `policy_key`, `value` (JSONB), `effective_from`, `effective_to`

4. **promotion_cycles** - Promotion cycle definitions
   - `id`, `org_id`, `name`, `period` (QUARTERLY/H1/ANNUAL/CUSTOM), `start_date`, `end_date`, `status` (DRAFT/OPEN/REVIEW/APPROVAL/CLOSED), `criteria` (JSONB)

5. **promotion_evaluations** - Promotion evaluations
   - `id`, `cycle_id`, `employee_id`, `manager_id`, `rating`, `remarks`, `recommendation` (NONE/PROMOTE/HOLD), `attachments` (JSONB)

6. **invite_tokens** - Email invite tokens
   - `id`, `org_id`, `email`, `token` (unique, 32+ bytes), `expires_at`, `used_at`

7. **audit_logs** - Audit trail
   - `id`, `org_id`, `actor_user_id`, `action`, `object_type`, `object_id`, `payload` (JSONB)

### Updated Tables

- **organizations** - Added `slug` column (unique)
- **profiles** - Added `status` column (INVITED/ACTIVE)

## Row-Level Security (RLS)

All tenant-scoped tables have RLS enabled with policies that check `app.org_id` session variable:

```sql
CREATE POLICY org_isolation_orgs ON organizations
  USING (id = current_setting('app.org_id', true)::uuid);
```

The middleware sets `app.org_id` using `SET LOCAL` for transaction-scoped RLS (better for connection pooling).

## API Endpoints

### Organizations
- `POST /api/orgs` - Create organization (generates slug)
- `GET /api/orgs/resolve?slug=...` - Resolve org by slug
- `GET /api/organizations/me` - Get current user's org (updated to include slug)

### Policies
- `GET /api/policies/catalog` - Get policy catalog
- `GET /api/policies/org` - Get effective org policies
- `POST /api/policies/org` - Create/update org policy (HR/CEO/Admin)
- `GET /api/policies/employee/:userId` - Get resolved policies for employee
- `POST /api/policies/employee/:userId` - Create employee policy override (HR/CEO/Admin)

### Promotion Cycles
- `GET /api/promotion/health` - Health check (active cycle, pending evaluations)
- `POST /api/promotion/cycles` - Create promotion cycle (HR/CEO/Admin)
- `GET /api/promotion/cycles/current` - Get current promotion cycles
- `POST /api/promotion/evaluations` - Submit evaluation (Manager)
- `POST /api/promotion/review/:id` - Review evaluation (HR)
- `POST /api/promotion/approve/:id` - Approve promotion (CEO/Admin)

### User Invites
- `POST /api/users/invite` - Invite users (creates invite tokens, sends emails) (HR/CEO/Admin)
  - Body: `{ emails: string[], role, org_id }`

### Authentication
- `POST /api/auth/first-login` - First login with invite token
  - Body: `{ token, newPassword }`
  - Returns JWT with `org_id` claim

### Admin
- `DELETE /api/admin/orgs/:orgId/reset` - Tenant-safe reset (ADMIN/CEO only)
  - Requires: `X-CONFIRM-RESET` header with org slug
  - Optional: `X-RESET-PASSPHRASE` header if `ORG_RESET_CONFIRM` env var is set

## Middleware

### Auth Middleware (`server/middleware/auth.js`)
- Extracts `org_id` from JWT or fetches from database
- Sets `req.orgId` for use by other middleware
- Updated to include `org_id` in JWT tokens

### Tenant Middleware (`server/middleware/tenant.js`)
- `setTenantContext` - Sets tenant context from request
- `resolveOrgFromSlug` - Resolves org from subdomain or path param
  - Checks subdomain: `{orgSlug}.app.com`
  - Checks path param: `/o/:orgSlug`
  - Checks query param: `?slug=...`
  - Verifies JWT org_id matches resolved org_id

## Email Service

### Email Service (`server/services/email.js`)
- Sends invite emails with tokenized links
- Supports subdomain or path-based URLs
- Falls back to console logging if SMTP not configured
- Uses nodemailer for SMTP

**Environment Variables:**
- `SMTP_HOST` - SMTP server host
- `SMTP_PORT` - SMTP server port
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `SMTP_SECURE` - Use TLS (true/false)
- `APP_BASE_URL` - Base URL for invite links
- `EMAIL_FROM` - From address

## Database Functions

### `resolve_policy_value(user_id, policy_key, date)`
Resolves policy value with priority:
1. Employee override (if exists and active on date)
2. Org policy (if exists and active on date)
3. NULL (if neither exists)

## Scripts

### Seed Policy Catalog
```bash
npm run seed:policies
```
Seeds `policy_catalog` with 20+ common policies across categories:
- Employment (probation, notice period)
- Leave (annual, sick, casual, carry forward)
- Work (overtime rules, remote work)
- Workplace (attire, dress code)
- Company (goals, values)
- Holiday (scheme by state or remote fixed)
- Benefits (health insurance, retirement)
- Performance (review frequency, rating scale)

### Reset Organization
```bash
npm run org:reset --org=<slug> [--passphrase=<passphrase>]
```
Or:
```bash
node server/scripts/reset-org.js <slug>
```

Resets organization data (promotion cycles, policies, audit logs, invite tokens).

## Security Features

1. **RLS Policies** - Database-level tenant isolation
2. **JWT with org_id** - Token includes organization ID
3. **Cross-org Access Prevention** - Middleware verifies org_id matches
4. **Token Security** - Invite tokens are 32+ bytes, single-use, expire in 72 hours
5. **Reset Protection** - Requires slug confirmation and optional passphrase

## Migration

Run the migration file:
```sql
\i server/db/migrations/20241201_multi_tenant_rls.sql
```

This will:
1. Add `slug` column to organizations
2. Add `status` column to profiles
3. Create all new tables
4. Enable RLS on all tenant-scoped tables
5. Create RLS policies
6. Create `resolve_policy_value` function

## Next Steps

### UI Components (Pending)
1. **Onboarding Wizard** - Multi-step form for first-time login
2. **Policies Management UI** - View/edit org and employee policies
3. **Promotion Cycle UI** - Create cycles, submit reviews, approve promotions

### Integration
1. Update signup flow to use new org creation endpoint
2. Update auth flow to handle org resolution from slug
3. Add policy acknowledgment in onboarding
4. Add promotion cycle dashboard

## Testing

1. **RLS Testing** - Verify cross-org access is blocked
2. **Policy Resolution** - Test employee override > org policy
3. **Invite Flow** - Test email invite → first login → onboarding
4. **Promotion Cycle** - Test cycle creation → evaluation → review → approval
5. **Reset** - Test tenant reset with proper guards

## Environment Variables

Add to `.env`:
```
# SMTP (optional, defaults to console logging)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_user
SMTP_PASS=your_pass
SMTP_SECURE=false

# App
APP_BASE_URL=https://app.com
EMAIL_FROM="HR Portal <no-reply@app.com>"

# Reset (optional)
ORG_RESET_CONFIRM=your-secure-passphrase
```

## Notes

- RLS uses `SET LOCAL` for transaction-scoped context (better for connection pooling)
- Policy resolution respects effective date windows
- Invite tokens are single-use and expire after 72 hours
- All writes are logged to `audit_logs`
- Tenant reset preserves the organization record and requesting admin user

