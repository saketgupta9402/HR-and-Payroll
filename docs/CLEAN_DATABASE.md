# Clean Database - Start Fresh

This guide explains how to clean all data from the database while preserving the schema (tables, indexes, triggers, etc.).

## Files Created

1. **`server/db/clean_data.sql`** - SQL script to delete all data
2. **`server/db/clean_database.js`** - Node.js script to clean the database

## Method 1: Using Node.js Script (Easiest)

Run this command from the project root:

```bash
node server/db/clean_database.js
```

This script will:
- Connect to the database
- Delete all data from all tables in the correct order
- Show progress for each table
- Handle errors gracefully

## Method 2: Using SQL Script Directly

### If using Docker:

```bash
docker-compose exec postgres psql -U postgres -d hr_suite -f /docker-entrypoint-initdb.d/clean_data.sql
```

Or copy the file and run it:

```bash
docker cp server/db/clean_data.sql hr-suite-postgres:/tmp/clean_data.sql
docker-compose exec postgres psql -U postgres -d hr_suite -f /tmp/clean_data.sql
```

### If using PostgreSQL directly:

```bash
psql -U postgres -d hr_suite -f server/db/clean_data.sql
```

## What Gets Cleaned

The script deletes data from all tables including:

- **Users & Authentication**: `profiles`, `user_auth`, `user_roles`, `employees`
- **Organizations**: `organizations`
- **Leave Management**: `leave_requests`, `leave_policies`
- **Timesheets**: `timesheets`, `timesheet_entries`
- **Attendance**: `attendance_events`, `attendance_uploads`, `attendance_upload_rows`, `attendance_audit_logs`
- **Holidays**: `holidays`, `holiday_lists`, `holiday_audit_logs`
- **Projects**: `projects`, `assignments`, `employee_projects`, `skills`, `certifications`
- **Performance**: `performance_reviews`, `appraisal_cycles`
- **Approvals**: `approvals`, `approval_audit`
- **Other**: `notifications`, `shifts`, `workflows`, `onboarding_data`, `check_in_check_outs`, `ai_conversations`, etc.

## What is Preserved

✅ **All tables** - Structure remains intact
✅ **All indexes** - Performance indexes remain
✅ **All triggers** - Automatic updates remain
✅ **All functions** - Database functions remain
✅ **All constraints** - Foreign keys, checks, etc. remain
✅ **All sequences** - Auto-increment sequences remain
✅ **Schema structure** - Everything except data

## Warning

⚠️ **This will permanently delete ALL data from the database!**

Make sure you:
- Have backups if needed
- Are ready to start fresh
- Understand that this cannot be undone

## Verification

After running the cleanup, you can verify all tables are empty by checking table row counts. The SQL script includes commented-out verification queries you can uncomment if needed.

