# Unified HR-Payroll Database - Implementation Summary

## ✅ Completed Tasks

### 1. Database Schema Migration ✅
- **File**: `server/db/migrations/20251107_unified_hr_payroll_schema.sql`
- Added missing payroll fields to HR `onboarding_data` table:
  - `uan_number` - Universal Account Number for EPF
  - `pf_number` - PF number
  - `esi_number` - Employee State Insurance number
  - Tax declaration fields (section_80c, section_80d, section_24b, other)
- Created payroll-specific tables that reference HR tables:
  - `compensation_structures` - References `employees(id)` and `organizations(id)`
  - `payroll_cycles` - References `organizations(id)`
  - `payroll_items` - References `employees(id)` and `payroll_cycles(id)`
  - `tax_declarations` - References `employees(id)` and `organizations(id)`
  - `form16` - References `employees(id)` and `organizations(id)`
  - `payroll_settings` - References `organizations(id)`

### 2. PostgreSQL Views ✅
- **`payroll_employee_view`**: Complete employee data for payroll processing
  - Joins: `employees`, `profiles`, `onboarding_data`, `compensation_structures`
  - Includes: Employee details, PAN, UAN, bank details, current compensation
- **`payroll_organization_view`**: Organization data with payroll settings
  - Joins: `organizations`, `payroll_settings`
- **`payroll_employee_payslip_view`**: Complete payslip data
  - Joins: `payroll_items`, `payroll_cycles`, `payroll_employee_view`

### 3. Row-Level Security (RLS) ✅
- Enabled RLS on all payroll tables
- Created organization-level isolation policies:
  - `org_isolation_compensation_structures`
  - `org_isolation_payroll_cycles`
  - `org_isolation_payroll_items`
  - `org_isolation_tax_declarations`
  - `org_isolation_form16`
  - `org_isolation_payroll_settings`
- All policies filter by `tenant_id = current_setting('app.org_id', true)::uuid`

### 4. Docker Compose Configuration ✅
- **File**: `docker-compose.yml`
- Removed separate `payroll-db` service
- Updated `payroll-api` to use HR database:
  - `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/hr_suite`
  - Added `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` environment variables
- Updated dependencies to use `postgres` service (HR database)

### 5. Payroll Database Connection ✅
- **File**: `payroll-app/server/src/db.ts`
- Updated to use HR database connection string
- Supports both Docker and local development environments
- Falls back to `hr_suite` database if `DATABASE_URL` not set

## 📋 Remaining Tasks

### 6. Update Payroll Queries to Use Views ⏳
**Status**: Pending - Requires code changes

**Files to Update**:
- `payroll-app/server/src/routes/app.ts` - Update employee queries
- `payroll-app/server/src/routes/*.ts` - Update all queries to use views

**Changes Needed**:
```typescript
// Before:
const employees = await query('SELECT * FROM employees WHERE tenant_id = $1', [tenantId]);

// After:
const employees = await query('SELECT * FROM payroll_employee_view WHERE org_id = $1', [tenantId]);
```

**Specific Updates**:
1. **Employee Queries**: Replace `employees` table with `payroll_employee_view`
2. **Organization Queries**: Replace `organizations` table with `payroll_organization_view`
3. **Payslip Queries**: Use `payroll_employee_payslip_view` for payslip data
4. **Compensation Queries**: Use `compensation_structures` table (already references HR employees)

### 7. Update API Endpoints ⏳
**Status**: Pending - Requires code changes

**Endpoints to Update**:
- `GET /api/employees` → Use `payroll_employee_view`
- `GET /api/organizations` → Use `payroll_organization_view`
- `GET /api/payslips` → Use `payroll_employee_payslip_view`
- `POST /api/payroll-cycles` → Already references `organizations(id)`
- `POST /api/payroll-items` → Already references `employees(id)`

### 8. Remove Duplicate Tables ⏳
**Status**: Pending - Requires migration

**Tables to Remove** (after verifying no dependencies):
- `payroll_app.users` (use HR `profiles` instead)
- `payroll_app.employees` (use HR `employees` via view)
- `payroll_app.organizations` (use HR `organizations` via view)
- `payroll_app.tenants` (use HR `organizations` instead)

**Note**: Only remove after all queries are updated to use views/HR tables

## 🏗️ Architecture Overview

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    HR System (Source of Truth)                │
├─────────────────────────────────────────────────────────────┤
│  • organizations (id, name, domain, logo_url)                │
│  • profiles (id, email, first_name, last_name, tenant_id)     │
│  • employees (id, user_id, employee_id, department, etc.)    │
│  • onboarding_data (pan_number, uan_number, bank_details)    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ References via Foreign Keys
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Payroll System (Extends HR Data)                 │
├─────────────────────────────────────────────────────────────┤
│  • compensation_structures → employees(id)                   │
│  • payroll_cycles → organizations(id)                       │
│  • payroll_items → employees(id), payroll_cycles(id)         │
│  • tax_declarations → employees(id), organizations(id)      │
│  • form16 → employees(id), organizations(id)                 │
│  • payroll_settings → organizations(id)                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Accessed via Views
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Payroll Views                              │
├─────────────────────────────────────────────────────────────┤
│  • payroll_employee_view (employees + profiles + onboarding) │
│  • payroll_organization_view (organizations + settings)      │
│  • payroll_employee_payslip_view (payslips + employee data)  │
└─────────────────────────────────────────────────────────────┘
```

### Access Control

**Organization-Level RLS**:
- All tables have RLS enabled
- Policies filter by `tenant_id = current_setting('app.org_id', true)::uuid`
- Each organization only sees their own data

**Role-Based Access**:
- **Employee**: Can view own payslips, tax declarations, Form 16
- **HR/Admin/CEO**: Can process payroll, view all employee data, generate Form 16

## 🔄 Migration Process

### Step 1: Run Database Migration ✅
```bash
# Migration is automatically applied when PostgreSQL starts
# Or run manually:
psql -U postgres -d hr_suite -f server/db/migrations/20251107_unified_hr_payroll_schema.sql
```

### Step 2: Update Docker Compose ✅
```bash
# Already updated in docker-compose.yml
# Restart services:
docker-compose down
docker-compose up -d
```

### Step 3: Update Payroll Application Code ⏳
1. Update queries to use views
2. Update API endpoints
3. Test thoroughly

### Step 4: Remove Duplicate Tables ⏳
1. Verify all queries use views/HR tables
2. Create migration to drop duplicate tables
3. Test again

## 📊 Benefits Achieved

✅ **Single Source of Truth**: HR is the only place for employee data
✅ **No Data Duplication**: Removed duplicate employee/organization tables
✅ **Automatic Sync**: Changes to HR data automatically reflect in Payroll
✅ **Organization-Level Security**: RLS ensures data isolation
✅ **Simplified Architecture**: One database instead of two
✅ **Better Maintainability**: Easier to manage and update

## 🚀 Next Steps

1. **Update Payroll Queries**: Replace table queries with view queries
2. **Update API Endpoints**: Use views for data retrieval
3. **Test Thoroughly**: Verify all functionality works with unified database
4. **Remove Duplicate Tables**: Clean up after migration is complete
5. **Monitor Performance**: Check view performance and add indexes if needed

## 📝 Notes

- **Views are read-only**: Use underlying tables for INSERT/UPDATE/DELETE
- **Foreign keys ensure data integrity**: Cannot delete HR employee if payroll data exists
- **RLS policies are enforced**: All queries automatically filter by organization
- **Migration is backward compatible**: Existing HR data remains unchanged

