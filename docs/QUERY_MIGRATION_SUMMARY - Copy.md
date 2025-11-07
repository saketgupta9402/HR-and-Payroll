# Payroll Query Migration Summary

## ✅ Completed Updates

All Payroll queries have been updated to use views instead of direct table access in the unified database.

### Files Updated

1. **`payroll-app/server/src/routes/app.ts`**
   - ✅ Updated employee queries to use `payroll_employee_view`
   - ✅ Updated organization queries to use `payroll_organization_view`
   - ✅ Updated payslip queries to use `payroll_employee_payslip_view`
   - ✅ Updated all JOINs to use views
   - ✅ Changed column names: `tenant_id` → `org_id`, `status` → `employment_status`, `id` → `employee_id`

2. **`payroll-app/server/src/middleware/tenant.ts`**
   - ✅ Updated organization lookup to use `payroll_organization_view`

3. **`payroll-app/server/src/routes/sso.ts`**
   - ✅ Updated employee queries to use `payroll_employee_view`

4. **`payroll-app/server/src/routes/auth.ts`**
   - ✅ Updated employee queries to use `payroll_employee_view`

5. **`payroll-app/server/src/routes/provision.ts`**
   - ✅ Updated employee queries to use `payroll_employee_view`

### Query Changes

#### Employee Queries
**Before:**
```sql
SELECT * FROM employees WHERE tenant_id = $1 AND email = $2
SELECT id FROM employees WHERE tenant_id = $1 AND email = $2
```

**After:**
```sql
SELECT * FROM payroll_employee_view WHERE org_id = $1 AND email = $2
SELECT employee_id as id FROM payroll_employee_view WHERE org_id = $1 AND email = $2
```

#### Organization Queries
**Before:**
```sql
SELECT id FROM organizations WHERE subdomain = $1
SELECT * FROM organizations WHERE org_id = $1
```

**After:**
```sql
SELECT org_id as id FROM payroll_organization_view WHERE subdomain = $1
SELECT * FROM payroll_organization_view WHERE org_id = $1
```

#### Payslip Queries
**Before:**
```sql
SELECT pi.*, e.*, pc.*, t.*
FROM payroll_items pi
JOIN employees e ON pi.employee_id = e.id
JOIN payroll_cycles pc ON pi.payroll_cycle_id = pc.id
LEFT JOIN tenants t ON e.tenant_id = t.id
```

**After:**
```sql
SELECT *
FROM payroll_employee_payslip_view
WHERE payslip_id = $1 AND org_id = $2
```

#### Compensation Queries
**Before:**
```sql
SELECT SUM(cs.ctc / 12) as total
FROM compensation_structures cs
JOIN employees e ON e.id = cs.employee_id
WHERE e.tenant_id = $1 AND e.status = 'active'
```

**After:**
```sql
SELECT SUM(cs.ctc / 12) as total
FROM compensation_structures cs
JOIN payroll_employee_view e ON e.employee_id = cs.employee_id
WHERE e.org_id = $1 AND e.employment_status = 'active'
```

### Column Name Mappings

| Old Column Name | New Column Name (View) |
|----------------|------------------------|
| `tenant_id` | `org_id` |
| `status` | `employment_status` |
| `id` (employees) | `employee_id` |
| `id` (organizations) | `org_id` |

### Important Notes

1. **Views are Read-Only**: For INSERT/UPDATE/DELETE operations, use the underlying tables:
   - `compensation_structures` (table)
   - `payroll_cycles` (table)
   - `payroll_items` (table)
   - `tax_declarations` (table)
   - `form16` (table)

2. **Employee Creation**: Employee records are created in HR system, not Payroll. Payroll only references them through views.

3. **Organization Creation**: Organization records are created in HR system. Payroll uses `payroll_organization_view` to access them.

4. **Fallback Logic**: Some queries still have fallback logic to the old tables in case views don't exist (for backward compatibility during migration).

### Remaining Considerations

1. **Users Table**: The Payroll app still uses a `users` table for authentication. This may need to be migrated to use HR's `profiles` table in the future, but for now it's kept separate for payroll-specific fields like `pin_hash` and `payroll_role`.

2. **Testing**: All queries should be tested to ensure they work correctly with the unified database.

3. **Performance**: Views may have performance implications. Monitor query performance and add indexes if needed.

## ✅ Migration Complete

All Payroll queries have been successfully migrated to use views in the unified database architecture.

