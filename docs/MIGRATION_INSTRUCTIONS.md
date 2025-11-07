# Database Migration Instructions

## Issue: Missing `slug` Column

The error `column "slug" does not exist` occurs because the `organizations` table doesn't have the `slug` column yet. The code has been updated to handle this gracefully, but you should run the migration to add the column.

## Quick Fix: Run Migration

### Option 1: Run the migration SQL file

```bash
# Connect to PostgreSQL container
docker exec -i hr-suite-postgres psql -U postgres -d hr_suite < server/db/migrations/add_slug_column.sql
```

Or if using docker-compose:

```bash
docker-compose exec postgres psql -U postgres -d hr_suite < server/db/migrations/add_slug_column.sql
```

### Option 2: Run the full multi-tenant migration

```bash
docker exec -i hr-suite-postgres psql -U postgres -d hr_suite < server/db/migrations/20241201_multi_tenant_rls.sql
```

### Option 3: Manual SQL (if containers are not running)

Connect to your PostgreSQL database and run:

```sql
-- Add slug column if it doesn't exist
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Create index
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Generate slugs for existing organizations
UPDATE organizations 
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Remove leading/trailing hyphens
UPDATE organizations 
SET slug = TRIM(BOTH '-' FROM slug)
WHERE slug IS NOT NULL;
```

## Current Status

The application code has been updated to:
- Check if the `slug` column exists before using it
- Return `slug: null` if the column doesn't exist
- Work without the column (backward compatible)

However, to use all multi-tenant features (slug-based routing, etc.), you should run the migration.

## Verify Migration

After running the migration, verify it worked:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'organizations' 
ORDER BY ordinal_position;
```

You should see `slug` in the list.

