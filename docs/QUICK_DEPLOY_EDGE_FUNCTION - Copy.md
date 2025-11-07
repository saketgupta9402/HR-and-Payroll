# Quick Fix: Deploy Edge Function

The CORS error happens because the Edge Function isn't deployed. Here are 3 ways to fix it:

## Option 1: Deploy via Supabase Dashboard (5 minutes)

1. **Go to**: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl/functions
2. **Click "Create a new function"** or **"New Function"**
3. **Function name**: `create-employee`
4. **Copy code from**: `supabase/functions/create-employee/index.ts`
   - Open the file
   - Copy ALL the code
   - Paste into the Dashboard editor
5. **Click "Deploy"**

## Option 2: Install Supabase CLI (Windows)

Download from: https://github.com/supabase/cli/releases

Or use Scoop:
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Then:
```powershell
supabase login
supabase link --project-ref oopgvhkegreimslgqypl
supabase functions deploy create-employee
```

## Option 3: Manual Creation via Dashboard

1. Go to Dashboard → Edge Functions
2. Create new function named `create-employee`
3. Use the code from the file (I'll provide complete standalone version below)

---

## Important: Set Secrets After Deployment

After deploying, you MUST set these secrets:

1. Go to: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl/functions/create-employee/settings
2. Add secrets:
   - `SUPABASE_URL` = `https://oopgvhkegreimslgqypl.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = (get from Settings → API → service_role key)

**Get Service Role Key**: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl/settings/api

---

## Test After Deployment

1. Try creating an employee again
2. Check function logs if errors: Dashboard → Edge Functions → create-employee → Logs

