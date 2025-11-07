# Fix: User Not Confirmed

Your user `zama@zc.com` exists but `confirmed_at` is `null`, which prevents login.

## Quick Fix Options

### Option 1: Confirm User in Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl/auth/users
2. Find user `zama@zc.com`
3. Click on the user to open details
4. Look for **"Confirm user"** or **"Email confirmed"** toggle
5. Enable/check it to confirm the user
6. Save changes

OR use the Actions menu:
- Click the **three dots** (⋮) next to the user
- Select **"Confirm user"** or **"Confirm email"**

### Option 2: Disable Email Confirmation (For Development)

This allows all future signups to login immediately:

1. Go to: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl/auth/settings
2. Find **"Enable email confirmations"**
3. **Turn it OFF** (uncheck)
4. Click **Save**

Then manually confirm existing users (see Option 3).

### Option 3: Confirm User via SQL (Quick)

Run this in **SQL Editor**:

```sql
-- Confirm the user
UPDATE auth.users 
SET 
  confirmed_at = now(),
  email_confirmed_at = now()
WHERE email = 'zama@zc.com';
```

### Option 4: Set Password (If Needed)

If password was not set or you need to reset it:

1. In Supabase Dashboard → **Authentication** → **Users**
2. Click on `zama@zc.com`
3. Go to **"Change Password"** or **"Reset Password"**
4. Set password to `123456` (or your password)
5. Make sure **"Auto Confirm User"** is checked when setting password

---

## After Fixing

1. **Refresh your browser** (or restart app)
2. Go to http://localhost:3000
3. Login with:
   - Email: `zama@zc.com`
   - Password: (whatever you set)
4. Should work now!

---

## Check User Status

To verify user is confirmed, run:

```sql
SELECT 
  email,
  confirmed_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users 
WHERE email = 'zama@zc.com';
```

If `confirmed_at` is NOT NULL, user is confirmed and can login.

