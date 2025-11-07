# Fix Login 400 Error

## Problem
Getting `400 Bad Request` error when trying to login. This usually means:

1. **No user exists** with that email
2. **Email confirmation is required** but user hasn't confirmed
3. **Wrong password**
4. **Supabase authentication settings** need configuration

## Solutions

### Solution 1: Create a User Account First

**You need to create an account before you can login!**

#### Option A: Sign Up via App (Recommended)
1. Go to http://localhost:3000
2. Click **"Sign up"** link
3. Fill in the form:
   - Email: `ceo@test.com`
   - Password: `Test123!` (or your choice)
   - First Name: John
   - Last Name: Doe
   - Organization Name: Test Company
   - Domain: test.com
   - Company Size: Small (1-50)
   - Industry: Technology
   - Timezone: (Select your timezone)
4. Click Sign Up

#### Option B: Create via Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl
2. Click **Authentication** → **Users**
3. Click **Add User** or **Invite User**
4. Enter:
   - Email: `ceo@test.com`
   - Password: `Test123!`
   - **Auto Confirm User**: ✅ (IMPORTANT - check this box!)
5. Click **Create User**

### Solution 2: Disable Email Confirmation (For Development)

Email confirmation might be blocking login. To disable it:

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl
2. Click **Authentication** → **Settings**
3. Under **Email Auth**, find **"Enable email confirmations"**
4. **Turn it OFF** (uncheck it)
5. Scroll down and click **Save**

### Solution 3: Verify User Exists

Check if the user you're trying to login with actually exists:

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Look for the email you're trying to login with
3. If it doesn't exist, create it first (see Solution 1)

### Solution 4: Check User Status

If user exists but login fails:

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Find your user
3. Check:
   - **Confirmed** should be ✅ (green checkmark)
   - If it's ❌, click on the user and manually confirm them

## Quick Test

Try this:
1. **First, sign up** at http://localhost:3000/auth/signup
2. Use: `ceo@test.com` / `Test123!`
3. Fill in organization details
4. After signup, **try logging in** with the same credentials

## Common Error Messages

- **"Invalid login credentials"** → User doesn't exist or wrong password
- **"Email not confirmed"** → Need to disable email confirmation or confirm email
- **"User not found"** → Create the user first

## After Fixing

Once you've created a user and disabled email confirmation (for dev), you should be able to login successfully!

---

**Note**: The improved error handling now shows the actual error message, so you'll see what the specific issue is.

