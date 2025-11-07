# Quick Supabase Setup (5 Minutes)

## ⚡ Fast Setup Steps

### 1. Disable Email Confirmation (REQUIRED)
- Go to: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl/auth/settings
- Find **"Enable email confirmations"**
- **Turn it OFF** ❌
- Click **Save**

### 2. Set Site URL
- Still in **Authentication** → **Settings**
- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: Add `http://localhost:3000` and `http://localhost:8080`
- Click **Save**

### 3. Verify Database Migrations
- Go to: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl/editor
- Check if you see tables like `profiles`, `organizations`, `employees`
- If NO tables: Run migrations (see step 4)
- If YES tables: ✅ You're good!

### 4. Run Migrations (If Needed)
- Go to **SQL Editor**
- Click **New Query**
- Copy entire contents of: `supabase/migrations/20251029063529_remix_batch_18_migrations.sql`
- Paste and click **Run**

### 5. Verify `.env` File
Your `.env` should have:
```env
VITE_SUPABASE_URL=https://oopgvhkegreimslgqypl.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vcGd2aGtlZ3JlaW1zbGdxeXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjkzMjgsImV4cCI6MjA3NzMwNTMyOH0.UXM46xbJWCYpx0xxURdvPGCyenQus5QkME9u09UReQw
```

## ✅ Done! Now Test:

1. Go to http://localhost:3000
2. Click **"Sign up"**
3. Create an account (becomes CEO automatically)
4. Login with that account

**If login works, you're all set!** 🎉

## 🚨 Still Having Issues?

- **Login error?** → Make sure email confirmation is OFF (Step 1)
- **No tables?** → Run migrations (Step 4)
- **CORS error?** → Check Site URL (Step 2)

---

For detailed configuration, see `SUPABASE_CONFIGURATION_GUIDE.md`

