# Unified HR-Payroll Database Migration Guide

## Overview

This migration merges the HR and Payroll systems into a single unified database architecture. The HR system becomes the single source of truth for all employee and organization data, while Payroll extends this data through views and relationships.

## Architecture Changes

### Before (Separate Databases)
- **HR Database**: `hr_suite` - Contains organizations, profiles, employees, onboarding_data
- **Payroll Database**: `payroll` - Contains duplicate users, employees, organizations, plus payroll-specific tables

### After (Unified Database)
- **Single Database**: `hr_suite` - Contains all HR data + payroll-specific tables that reference HR tables
- **HR Tables**: Source of truth for employees, organizations, profiles
- **Payroll Tables**: Reference HR tables via foreign keys (compensation_structures, payroll_cycles, payroll_items, tax_declarations, form16)
- **Views**: Payroll consumes HR data through PostgreSQL views (payroll_employee_view, payroll_organization_view)

## Key Principles

1. **HR is Single Source of Truth**: All employee identity, personal data, onboarding information, and statutory identifiers (PAN, UAN, Aadhaar) are stored in HR tables
2. **Payroll Extends HR**: Payroll tables only store payroll-specific data (salaries, payslips, tax declarations) and reference HR employee records
3. **No Duplication**: Removed all duplicate employee/user/organization tables from Payroll
4. **Organization-Level RLS**: All queries filter by `org_id` (tenant_id) for security
5. **Views for Access**: Payroll accesses HR data through defined views, not direct table access

## Database Schema Changes

### Added to HR `onboarding_data` Table
- `uan_number` - Universal Account Number for EPF
- `pf_number` - PF number (if different from UAN)
- `esi_number` - Employee State Insurance number
- `tax_declaration_section_80c` - Tax declaration under Section 80C
- `tax_declaration_section_80d` - Tax declaration under Section 80D
- `tax_declaration_section_24b` - Tax declaration under Section 24B
- `tax_declaration_other` - Other tax declarations

### New Payroll Tables (Reference HR Tables)
- `compensation_structures` - References `employees(id)` and `organizations(id)`
- `payroll_cycles` - References `organizations(id)`
- `payroll_items` - References `employees(id)` and `payroll_cycles(id)`
- `tax_declarations` - References `employees(id)` and `organizations(id)`
- `form16` - References `employees(id)` and `organizations(id)`
- `payroll_settings` - References `organizations(id)`

### Views for Payroll
- `payroll_employee_view` - Complete employee data for payroll (joins employees, profiles, onboarding_data, compensation_structures)
- `payroll_organization_view` - Organization data with payroll settings
- `payroll_employee_payslip_view` - Complete payslip data with employee details

## Migration Steps

### 1. Run Database Migration

```bash
# The migration is automatically applied when PostgreSQL starts
# Or run manually:
psql -U postgres -d hr_suite -f server/db/migrations/20251107_unified_hr_payroll_schema.sql
```

### 2. Update Docker Compose

The `docker-compose.yml` has been updated to:
- Remove separate `payroll-db` service
- Configure `payroll-api` to use `postgres` service (HR database)
- Update `DATABASE_URL` to point to `hr_suite` database

### 3. Update Payroll Application Code

#### Database Connection
- Change from: `postgresql://postgres:mysecretpassword@payroll-db:5432/payroll`
- Change to: `postgresql://postgres:postgres@postgres:5432/hr_suite`

#### Query Updates
Replace direct table queries with views:

**Before:**
```sql
SELECT * FROM employees WHERE tenant_id = $1
```

**After:**
```sql
SELECT * FROM payroll_employee_view WHERE org_id = $1
```

#### Employee Data Access
- Use `payroll_employee_view` instead of `employees` table
- All employee fields (name, PAN, UAN, bank details) come from HR tables via the view

#### Organization Data Access
- Use `payroll_organization_view` instead of `organizations` table
- Organization name, logo, and payroll settings are available through the view

## Data Flow

### Employee Onboarding
1. HR creates employee in `employees` table
2. Employee completes onboarding in `onboarding_data` table (includes PAN, UAN, bank details)
3. Payroll automatically sees employee through `payroll_employee_view`
4. HR/Admin/CEO can add compensation structure in `compensation_structures` table

### Payroll Processing
1. HR/Admin/CEO creates payroll cycle in `payroll_cycles` table
2. System generates `payroll_items` for each employee (references `employees.id`)
3. Payslips are generated using `payroll_employee_payslip_view`
4. Employees can view their payslips through the view

### Tax Declarations
1. Employee submits tax declaration in `tax_declarations` table
2. HR/Admin/CEO approves it
3. Form 16 is generated from `form16` table
4. Employee can download Form 16

## Row-Level Security (RLS)

All payroll tables have RLS enabled with organization-level isolation:

```sql
-- Example policy
CREATE POLICY org_isolation_payroll_cycles ON payroll_cycles
  USING (tenant_id = current_setting('app.org_id', true)::uuid);
```

This ensures:
- Each organization only sees their own payroll data
- Employees can only see their own payslips
- HR/Admin/CEO can see all payroll data for their organization

## Role-Based Access Control

### Employee Role
- Can view: Own payslips, tax declarations, Form 16
- Cannot: Process payroll, view other employees' data

### HR/Admin/CEO Roles
- Can view: All payroll data for their organization
- Can process: Payroll cycles, generate payslips, approve tax declarations
- Can download: Any employee's Form 16

## API Changes Required

### Payroll API Endpoints

Update these endpoints to use views:

1. **GET /api/employees** → Use `payroll_employee_view`
2. **GET /api/organizations** → Use `payroll_organization_view`
3. **GET /api/payslips** → Use `payroll_employee_payslip_view`
4. **POST /api/payroll-cycles** → Insert into `payroll_cycles` (references `organizations.id`)
5. **POST /api/payroll-items** → Insert into `payroll_items` (references `employees.id`)

### Authentication
- Payroll continues to use PIN authentication
- Session management remains the same
- User identity comes from HR `profiles` table

## Testing Checklist

- [ ] Run migration script successfully
- [ ] Verify views are created and accessible
- [ ] Test employee data retrieval through `payroll_employee_view`
- [ ] Test organization data retrieval through `payroll_organization_view`
- [ ] Test payroll cycle creation
- [ ] Test payslip generation
- [ ] Verify RLS policies work correctly
- [ ] Test employee self-service (view own payslips)
- [ ] Test HR/Admin/CEO access (view all payroll data)
- [ ] Verify tax declaration submission
- [ ] Test Form 16 generation and download

## Rollback Plan

If issues occur, you can:

1. **Restore from backup** (if taken before migration)
2. **Revert docker-compose.yml** to use separate databases
3. **Update DATABASE_URL** in payroll-api to point back to payroll database

## Benefits

✅ **Single Source of Truth**: No data duplication between HR and Payroll
✅ **Data Consistency**: Employee data is always up-to-date in Payroll
✅ **Simplified Architecture**: One database to manage instead of two
✅ **Better Security**: Organization-level RLS ensures data isolation
✅ **Easier Maintenance**: Changes to employee data automatically reflect in Payroll
✅ **Reduced Storage**: No duplicate employee/organization records

## Next Steps

1. Update Payroll application code to use views
2. Update API endpoints to query views instead of tables
3. Test thoroughly in development environment
4. Deploy to production after successful testing
5. Monitor for any performance issues with views
6. Consider adding indexes if views are slow

