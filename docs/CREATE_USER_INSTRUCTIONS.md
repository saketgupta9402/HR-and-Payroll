# Create User: zama@zc.om

## Option 1: Create via Supabase Dashboard (Easiest)

1. Go to: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl
2. Click **Authentication** → **Users**
3. Click **Add User** button
4. Fill in:
   - **Email**: `zama@zc.om`
   - **Password**: `123456` (or your preferred password)
   - **Auto Confirm User**: ✅ (CHECK THIS - important!)
5. Click **Create User**

After creating, you can login immediately.

---

## Option 2: Sign Up via App

1. Go to http://localhost:3000
2. Click **"Sign up"** link
3. Fill in the signup form:
   - Organization Name: Your Company
   - Domain: zc.om
   - Your Name: Zama (or your name)
   - Email: `zama@zc.om`
   - Password: `123456`
   - Company details
4. Click **"Create account"**

**Note**: If signup gives 500 error, we need to check the database trigger (see troubleshooting below).

---

## Option 3: Create via SQL (Advanced)

Run this in Supabase SQL Editor:

```sql
-- First, create the user in auth
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'zama@zc.om',
  crypt('123456', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"first_name": "Zama", "last_name": ""}'
) RETURNING id;
```

Then create profile and role (you'll need the user ID from above).

---

## Troubleshooting

### If Signup Still Gives 500 Error

The database trigger might be failing. Check:

1. **Go to Supabase Dashboard** → **Logs** → **Database Logs**
2. Look for errors when signing up
3. Common issues:
   - Organizations table doesn't exist
   - Trigger function has errors
   - Missing columns

### Check if User Already Exists

Run this in SQL Editor:

```sql
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'zama@zc.om';
```

If it returns a row but login still fails:
- Password might be wrong
- User might not be confirmed (set `email_confirmed_at` to current timestamp)

### Force Confirm User

If user exists but isn't confirmed:

```sql
UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email = 'zama@zc.om';
```

---

## Quick Test After Creating User

1. Go to http://localhost:3000
2. Login with:
   - Email: `zama@zc.om`
   - Password: `123456`
3. Should work now!

