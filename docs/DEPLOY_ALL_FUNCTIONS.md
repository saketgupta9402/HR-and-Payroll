# Deploy All Required Edge Functions

You need to deploy these functions to fix CORS errors:

1. ✅ `create-employee` - For adding employees
2. ✅ `verify-employee-email` - For first-time login verification
3. ⚠️ `setup-employee-password` - For password setup (needed later)
4. ⚠️ `generate-roster` - For shift management (optional)
5. ⚠️ `notify-shift-created` - For notifications (optional)
6. ⚠️ `ai-chat` - For AI assistant (optional)

## Quick Deploy (Dashboard Method)

### Step 1: Deploy `verify-employee-email` (URGENT - Fixes current error)

1. **Go to**: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl/functions
2. **Click "Create a new function"**
3. **Name**: `verify-employee-email`
4. **Copy code from**: `verify-employee-email-standalone-code.txt`
   - Open that file
   - Copy ALL code
   - Paste into Dashboard
5. **Click "Deploy"**

### Step 2: Deploy `create-employee` (Also needed)

1. **In same Dashboard**, click "Create a new function" again
2. **Name**: `create-employee`
3. **Copy code from**: `create-employee-standalone-code.txt`
4. **Paste and Deploy**

### Step 3: Set Secrets (For both functions)

After deploying each function, set these secrets:

1. Go to function Settings (click on function name → Settings)
2. Add secrets:
   - `SUPABASE_URL` = `https://oopgvhkegreimslgqypl.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = (from Settings → API)

**Get Service Role Key**: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl/settings/api

---

## Files Ready to Deploy

I've created standalone versions for easy copy-paste:

- ✅ `verify-employee-email-standalone-code.txt` - Ready to deploy
- ✅ `create-employee-standalone-code.txt` - Ready to deploy

Both have CORS headers fixed and are self-contained (no dependencies).

---

## After Deployment

1. ✅ Refresh your app
2. ✅ Try "First Time Login" - should work now
3. ✅ Try creating an employee - should work now

---

## Priority Order

**Deploy these first:**
1. `verify-employee-email` ← **FIXES YOUR CURRENT ERROR**
2. `create-employee` ← Needed for adding employees

**Deploy these later (when needed):**
3. `setup-employee-password` - When users set up passwords
4. Others - Only if you use those features

