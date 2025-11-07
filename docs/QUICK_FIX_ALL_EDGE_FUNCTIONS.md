# Quick Fix: Deploy Only 3 Essential Functions

You **don't need to deploy functions for everything!** Only these 3 are critical:

## Essential Functions (Deploy These)

### 1. ✅ `verify-employee-email` 
**Why:** Needed for "First Time Login" flow
**Code:** `verify-employee-email-standalone-code.txt`

### 2. ✅ `setup-employee-password`
**Why:** Needed to set passwords (requires admin API)
**Code:** `setup-employee-password-standalone-code.txt`

### 3. ✅ `create-employee`
**Why:** Needed to create new employees (requires admin API)
**Code:** `create-employee-standalone-code.txt`

---

## How to Deploy (Same for All)

1. Go to: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl/functions
2. Click **"Create a new function"**
3. Name the function (e.g., `setup-employee-password`)
4. Copy code from the `.txt` file I created
5. Paste and click **"Deploy"**
6. Set secrets (after each deployment):
   - `SUPABASE_URL` = `https://oopgvhkegreimslgqypl.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = (from Settings → API)

**Get Service Role Key:** https://supabase.com/dashboard/project/oopgvhkegreimslgqypl/settings/api

---

## About the 406 Error

The **406 error on `/rest/v1/employees`** is NOT an Edge Function issue!

It's a REST API query issue. Most likely:
- The query format needs fixing
- Or it's a missing Prefer header

**This should work with direct Supabase client - no function needed!**

I'll need to see the exact code causing it to fix it properly.

---

## Summary

✅ **Deploy these 3 functions** (about 5 minutes each)
✅ **Set secrets for each** (copy-paste the values)
✅ **Everything else works without functions!**

Most of your app uses direct Supabase queries which don't need Edge Functions at all.

