# Fix Edge Functions CORS Error

The error "404 on preflight" and CORS errors mean the Edge Functions aren't deployed to Supabase yet.

## Quick Fix: Deploy Edge Functions

### Option 1: Deploy via Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link your project**:
   ```bash
   supabase link --project-ref oopgvhkegreimslgqypl
   ```

4. **Deploy the function**:
   ```bash
   supabase functions deploy create-employee
   ```

5. **Deploy other functions** (if needed):
   ```bash
   supabase functions deploy verify-employee-email
   supabase functions deploy setup-employee-password
   supabase functions deploy generate-roster
   supabase functions deploy notify-shift-created
   supabase functions deploy ai-chat
   ```

### Option 2: Deploy via Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl/functions
2. Click **"New Function"**
3. Upload or create the function
4. (This is more manual, CLI is easier)

### Option 3: Use Supabase Management API (Advanced)

For now, let's focus on Option 1 (CLI).

---

## Alternative: Bypass Edge Functions (Temporary Fix)

If you can't deploy functions right now, you can temporarily call Supabase directly from the frontend. However, this won't work for creating users (requires admin access).

---

## After Deploying

1. **Set Function Secrets** (if needed):
   - Go to Supabase Dashboard → Edge Functions → Settings
   - Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as secrets

2. **Test the function**:
   - Try creating an employee again
   - Should work now without CORS errors

---

## Verify Deployment

1. Go to: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl/functions
2. You should see `create-employee` function listed
3. Click on it to see logs and details

---

## If You Don't Want to Deploy Functions

For local development, you could:
1. Create employees directly via Supabase Dashboard
2. Or modify the code to use Supabase client directly (but this requires admin access which isn't available from frontend)

**Best solution**: Deploy the Edge Functions as they're designed to work this way.

