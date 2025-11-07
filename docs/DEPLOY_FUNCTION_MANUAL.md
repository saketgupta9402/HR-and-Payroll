# Deploy Edge Function - Manual Method

Since the Edge Function isn't deployed and CLI installation has issuesetyl, here's how to deploy it manually:

## Method 1: Via Supabase Dashboard (Easiest)

1. **Go to Supabase Dashboard**:
   https://supabase.com/dashboard/project/oopgvhkegreimslgqypl/functions

2. **Click "Deploy a new function"** or **"Create Function"**

3. **Name it**: `create-employee`

4. **Copy the function code** from `supabase/functions/create-employee/index.ts`

5. **Also deploy the CORS helper** - you'll need to include the cors.ts code inline or deploy it as a shared module.

Actually, **better approach** - let me create a self-contained version:

