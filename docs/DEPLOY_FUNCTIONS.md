# Deploy Edge Functions - Step by Step

## Prerequisites
- Node.js installed
- Supabase account access

## Steps

### 1. Install Supabase CLI
```powershell
npm install -g supabase
```

### 2. Login
```powershell
supabase login
```
This opens a browser to authenticate.

### 3. Link Project
```powershell
supabase link --project-ref oopgvhkegreimslgqypl
```

### 4. Deploy Functions
```powershell
# Deploy create-employee (most important for now)
supabase functions deploy create-employee

# Deploy other functions
supabase functions deploy verify-employee-email
supabase functions deploy setup-employee-password
supabase functions deploy generate-roster
supabase functions deploy notify-shift-created
supabase functions deploy ai-chat
```

### 5. Set Secrets (If Required)
```powershell
# Set Supabase URL (if not auto-detected)
supabase secrets set SUPABASE_URL=https://oopgvhkegreimslgqypl.supabase.co

# Set Service Role Key (get from Dashboard → Settings → API)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get the service role key from: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl/settings/api

### 6. Test
After deploying, try creating an employee again. The CORS error should be gone!

---

## Troubleshooting

**"Function not found"**: Make sure you're in the project directory.

**"Authentication failed"**: Run `supabase login` again.

**"CORS still errors"**: 
- Check function logs in Supabase Dashboard
- Verify CORS headers are in the function code
- Make sure function is deployed (refresh functions page)

---

## Quick Command Reference

```powershell
# Check if CLI is installed
supabase --version

# Login
supabase login

# Link project
supabase link --project-ref oopgvhkegreimslgqypl

# List functions
supabase functions list

# Deploy specific function
supabase functions deploy create-employee

# View logs
supabase functions logs create-employee
```

