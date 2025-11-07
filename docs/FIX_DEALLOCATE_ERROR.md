# Fix Deallocate Assignment 500 Error

## Problem
The deallocate endpoint returns a 500 Internal Server Error because the `assignments` table is missing the `updated_at` column.

## Solution

Run the migration to add the missing column and triggers:

### Option 1: Run Migration via API Endpoint (Recommended)

1. Make sure your server is running on port 3001
2. Make a POST request to the migration endpoint:

```bash
curl -X POST http://localhost:3001/api/migrations/fix-assignments-updated-at \
  -H "Content-Type: application/json"
```

Or in your browser console while logged in:
```javascript
fetch('http://localhost:3001/api/migrations/fix-assignments-updated-at', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
})
.then(res => res.json())
.then(data => console.log('Migration result:', data));
```

### Option 2: Run SQL Directly

If you have direct database access, run this SQL:

```sql
-- Add updated_at column to assignments
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add index for end_date
CREATE INDEX IF NOT EXISTS idx_assignments_end_date ON assignments(end_date);

-- Create trigger for assignments updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_assignments_updated_at'
  ) THEN
    CREATE TRIGGER update_assignments_updated_at
    BEFORE UPDATE ON assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create trigger for projects updated_at if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_projects_updated_at'
  ) THEN
    CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create trigger for skills updated_at if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_skills_updated_at'
  ) THEN
    CREATE TRIGGER update_skills_updated_at
    BEFORE UPDATE ON skills
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
```

## Verification

After running the migration, the deallocate endpoint should work. Test by:

1. Navigate to a project with assignments
2. Click on "View Assigned"
3. Try to deallocate an assignment
4. It should work without errors

## What Was Fixed

1. Added `updated_at` column to `assignments` table
2. Added index on `end_date` for better query performance
3. Added triggers to automatically update `updated_at` on:
   - assignments
   - projects
   - skills

## Files Modified

- `server/db/migrations/20251030_skills_projects.sql` - Updated schema
- `server/db/migrations/20251101_fix_assignments_updated_at.sql` - New migration file
- `server/routes/migrations.js` - Added migration endpoint
- `server/routes/projects.js` - Already had correct code (no changes needed)

