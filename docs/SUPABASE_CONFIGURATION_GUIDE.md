# Complete Supabase Configuration Guide

This guide will help you configure your Supabase project for the HR Suite application.

## 📋 Table of Contents
1. [Access Your Supabase Dashboard](#access-your-supabase-dashboard)
2. [Configure Authentication](#configure-authentication)
3. [Configure Database](#configure-database)
4. [Configure Storage](#configure-storage)
5. [Configure Edge Functions](#configure-edge-functions)
6. [Configure API Settings](#configure-api-settings)
7. [Verify Configuration](#verify-configuration)

---

## 1. Access Your Supabase Dashboard

Your project URL: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl

**Project Details:**
- Project ID: `oopgvhkegreimslgqypl`
- Project URL: `https://oopgvhkegreimslgqypl.supabase.co`

---

## 2. Configure Authentication

### Step 1: Disable Email Confirmation (For Development)

1. In Supabase Dashboard, go to **Authentication** → **Settings**
2. Scroll to **Email Auth** section
3. Find **"Enable email confirmations"**
4. **Turn it OFF** (uncheck the toggle)
5. Click **Save**

**Why?** This allows immediate login without email verification during development.

### Step 2: Configure Auth Providers

1. Still in **Authentication** → **Settings**
2. Under **Auth Providers**, make sure **Email** is enabled ✅
3. (Optional) Disable other providers like Google, GitHub if you don't need them

### Step 3: Set Site URL

1. In **Authentication** → **Settings**
2. Find **Site URL**
3. Set it to: `http://localhost:3000` (for development)
4. Add **Redirect URLs**:
   - `http://localhost:3000`
   - `http://localhost:8080`
   - `http://localhost:3000/**` (wildcard)
5. Click **Save**

### Step 4: Configure Email Templates (Optional)

1. Go to **Authentication** → **Email Templates**
2. You can customize templates if needed, or leave default for now

---

## 3. Configure Database

### Step 1: Run Migrations (If Not Done)

1. Go to **SQL Editor** in Supabase Dashboard
2. Click **New Query**
3. Open the file: `supabase/migrations/20251029063529_remix_batch_18_migrations.sql`
4. Copy ALL contents (1025 lines)
5. Paste into SQL Editor
6. Click **Run** (or press F5)

**This creates all necessary tables, functions, and RLS policies.**

### Step 2: Verify Tables Were Created

1. Go to **Table Editor** in Supabase Dashboard
2. You should see these tables:
   - `profiles`
   - `user_roles`
   - `employees`
   - `organizations`
   - `leave_policies`
   - `leave_requests`
   - `timesheets`
   - `timesheet_entries`
   - `onboarding_data`
   - `workflows`
   - `appraisal_cycles`
   - `performance_reviews`
   - `shifts`
   - `notifications`

### Step 3: Check Row Level Security (RLS)

RLS policies are automatically created by the migration. To verify:

1. Go to **Database** → **Policies**
2. You should see policies for all tables
3. All tables should have RLS enabled (security ✅)

---

## 4. Configure Storage

### Step 1: Verify Storage Bucket

1. Go to **Storage** in Supabase Dashboard
2. You should see a bucket named `org-logos` (created by migration)
3. If not visible, it's created automatically when needed

### Step 2: Configure Bucket Policies

The migration already sets up policies, but verify:

1. Go to **Storage** → **Policies**
2. For `org-logos` bucket, you should have:
   - Public read access
   - CEO upload access

---

## 5. Configure Edge Functions

### Step 1: Deploy Edge Functions (If Needed)

If you plan to use Edge Functions, they need to be deployed. Currently you have:

- `ai-chat` - AI assistant chat function
- `create-employee` - Create employee accounts
- `generate-roster` - Generate work schedules
- `notify-shift-created` - Send notifications
- `setup-employee-password` - Setup employee passwords
- `verify-employee-email` - Verify employee emails

**Note:** Edge Functions require Supabase CLI to deploy. For local development, they may not be needed immediately.

### Step 2: Set Edge Function Secrets (If Deploying)

If you deploy edge functions, you may need to set secrets:
1. Go to **Edge Functions** → **Secrets**
2. Add any required API keys or secrets

---

## 6. Configure API Settings

### Step 1: Verify API Keys

1. Go to **Settings** → **API**
2. You should see:
   - **Project URL**: `https://oopgvhkegreimslgqypl.supabase.co`
   - **anon/public key**: `eyJhbGci...` (your key)
   - **service_role key**: (keep this secret!)

### Step 2: API Configuration

1. **Enable Realtime**: Should be enabled by default ✅
2. **Enable REST API**: Should be enabled by default ✅
3. **CORS**: Configure if needed (defaults should work for localhost)

---

## 7. Create Test Organization (Optional)

After running migrations, you can create a test organization:

1. Go to **SQL Editor**
2. Run this query to create a test organization:

```sql
INSERT INTO public.organizations (name, domain, company_size, industry, timezone)
VALUES ('Test Company', 'test.com', 'small', 'Technology', 'Asia/Kolkata')
RETURNING id, name;
```

3. Save the organization ID if you need it later

---

## 8. Verify Configuration

### Quick Checklist

- [ ] ✅ Email confirmation disabled (for dev)
- [ ] ✅ Site URL set to `http://localhost:3000`
- [ ] ✅ Migrations run successfully
- [ ] ✅ All tables created
- [ ] ✅ RLS policies enabled
- [ ] ✅ Storage bucket `org-logos` exists
- [ ] ✅ API keys in `.env` file match dashboard

### Test Configuration

1. **Test Signup:**
   - Go to http://localhost:3000
   - Click "Sign up"
   - Create a CEO account
   - Should work without email confirmation

2. **Test Login:**
   - Logout
   - Try logging in
   - Should work immediately

3. **Test Database:**
   - Check Supabase Dashboard → **Table Editor**
   - Verify `organizations` table has your company
   - Verify `profiles` table has your user
   - Verify `user_roles` shows `ceo` role

---

## 9. Environment Variables

Make sure your `.env` file has:

```env
VITE_SUPABASE_URL=https://oopgvhkegreimslgqypl.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vcGd2aGtlZ3JlaW1zbGdxeXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MjkzMjgsImV4cCI6MjA3NzMwNTMyOH0.UXM46xbJWCYpx0xxURdvPGCyenQus5QkME9u09UReQw
```

**Get these from:** Settings → API in Supabase Dashboard

---

## 10. Common Issues & Fixes

### Issue: "Email not confirmed" error
**Fix:** Disable email confirmation in Authentication → Settings

### Issue: "Invalid credentials" on login
**Fix:** Create user first via signup or Supabase Dashboard

### Issue: RLS blocking queries
**Fix:** Migrations should have set up policies. Check Database → Policies

### Issue: CORS errors
**Fix:** Add your localhost URLs to Authentication → Settings → Redirect URLs

### Issue: Edge Functions not working
**Fix:** Deploy functions using Supabase CLI or use Supabase Dashboard

---

## 11. Production Configuration (For Later)

When deploying to production:

1. **Enable Email Confirmation** again
2. **Update Site URL** to your production domain
3. **Configure proper CORS** settings
4. **Set up email templates** for production
5. **Review and tighten RLS policies**
6. **Set up database backups**
7. **Configure monitoring and alerts**

---

## Quick Start Summary

**Minimum required steps:**
1. ✅ Disable email confirmation
2. ✅ Set Site URL to `http://localhost:3000`
3. ✅ Run database migrations
4. ✅ Verify `.env` file has correct keys
5. ✅ Test signup and login

That's it! Your Supabase should now be configured for development.

---

## Need Help?

If you encounter issues:
1. Check the **Common Issues & Fixes** section above
2. Check Supabase logs: **Logs** → **API Logs** or **Database Logs**
3. Verify your `.env` file matches the dashboard settings

