# What Needs Edge Functions vs Direct Supabase Calls

## ❌ NO - These DON'T Need Edge Functions (Work with Direct Client)

These work directly with `supabase.from()` - **No functions needed:**

✅ **Querying Data:**
- Reading employees, profiles, leave requests, timesheets
- All `SELECT` queries
- Filtering, sorting, joining tables

✅ **Basic Updates:**
- Updating employee records
- Updating profiles
- Creating/updating leave requests
- Creating timesheets

✅ **Everything in these pages:**
- Employees list
- Dashboard stats
- Org Chart
- Leave Requests
- Timesheets
- Appraisals (most features)
- Settings

**These work fine without Edge Functions!**

---

## ✅ YES - These NEED Edge Functions (Require Admin Access)

These need Edge Functions because they use **admin APIs** or need **service role keys:**

1. ✅ **`create-employee`** - Creates new auth users (requires admin API)
2. ✅ **`verify-employee-email`** - Verifies employee for password setup
3. ✅ **`setup-employee-password`** - Updates passwords (requires admin API)
4. ⚠️ **`generate-roster`** - Generates shifts (might need admin)
5. ⚠️ **`notify-shift-created`** - Sends notifications (optional)
6. ⚠️ **`ai-chat`** - AI assistant (optional)

**Only these 3 are critical:**
- `create-employee` ✅
- `verify-employee-email` ✅
- `setup-employee-password` ✅

---

## The 406 Error Explanation

The **406 error** on `/rest/v1/employees?select=id&user_id=eq.xxx` is NOT an Edge Function issue.

It's a **PostgREST API issue**, likely:
- Missing `Prefer` header
- Query format issue
- Or RLS policy blocking

**Fix:** This should work with direct Supabase client, no function needed!

---

## Quick Summary

**You only need Edge Functions for 3 things:**
1. Creating employees (admin API)
2. Verifying employee email (for password setup flow)
3. Setting up passwords (admin API)

**Everything else uses direct Supabase client calls - no functions needed!**

---

## Current Errors Fix

1. ✅ **setup-employee-password CORS** → Deploy that function (code ready in `setup-employee-password-standalone-code.txt`)
2. ✅ **406 on employees query** → This is a code issue, not a function issue (I'll fix it next)

