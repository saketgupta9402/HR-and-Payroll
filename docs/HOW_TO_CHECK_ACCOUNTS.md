# How to Check and Create Accounts

## Current Situation

When you ran the database migrations, they deleted all existing users. So there are likely **0 accounts** right now.

## How to Check Existing Accounts

### Method 1: Supabase Dashboard

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/oopgvhkegreimslgqypl
2. Click on **Authentication** in the left sidebar
3. Click on **Users**
4. You'll see a list of all user accounts

### Method 2: SQL Query

1. In Supabase Dashboard, go to **SQL Editor**
2. Run this query:

```sql
SELECT 
  u.id,
  u.email,
  u.created_at,
  ur.role,
  p.first_name,
  p.last_name
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
ORDER BY u.created_at DESC;
```

This will show all accounts with their emails and roles.

---

## How to Create Test Accounts

### Option 1: Use the App's Signup Page (Easiest)

1. Go to http://localhost:3000
2. Click **Sign Up** or **Create Account**
3. Fill in the form:
   - **Email**: `ceo@test.com` (or any email)
   - **Password**: `Test123!` (or any password)
   - **First Name**: John
   - **Last Name**: Doe
   - **Organization Name**: Test Company (if CEO signup)
4. The **first user** automatically gets **CEO role**

### Option 2: Create via Supabase Dashboard

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Click **Add User** (or **Invite User**)
3. Enter:
   - **Email**: `ceo@test.com`
   - **Password**: `Test123!`
   - **Auto Confirm User**: ✅ (check this)
4. Click **Create User**
5. After creation, you may need to assign the CEO role (see below)

### Option 3: Create Multiple Test Accounts via SQL

Run this in SQL Editor to create a test CEO account (password still needs to be set via dashboard):

```sql
-- Create a user (this creates in auth.users, password must be set via dashboard)
-- After creating the user in dashboard, run this to check the user ID:
SELECT id, email FROM auth.users WHERE email = 'ceo@test.com';

-- Then assign CEO role (replace USER_ID with actual ID from above query)
-- Note: You'll need to create an organization first if none exists
```

---

## Recommended: Create Test Accounts via App

The easiest way is to just use the app:

1. **CEO Account** (First Signup):
   - Go to http://localhost:3000
   - Sign up with:
     - Email: `ceo@test.com`
     - Password: `Test123!`
     - Organization details (CEO signup form)
   - This automatically gets CEO role

2. **Employee Account** (After CEO exists):
   - Sign up with another email (or have CEO create via Employees page)
   - Email: `employee@test.com`
   - Password: `Test123!`
   - This gets Employee role

---

## Sample Test Accounts

Here are some test accounts you might want to create:

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| CEO | ceo@test.com | Test123! | Create via signup (first user) |
| HR | hr@test.com | Test123! | Create via CEO, then assign HR role |
| Manager | manager@test.com | Test123! | Create via CEO, then assign Manager role |
| Employee | employee@test.com | Test123! | Create via CEO or signup |

**Note**: Passwords are not stored in plain text in the database - you'll see them in Supabase Dashboard when you create users there, but if you create via the app, only you will know them.

---

## Quick Check Commands

To see how many accounts exist right now, run this in SQL Editor:

```sql
SELECT COUNT(*) as total_users FROM auth.users;
```

To see all accounts:

```sql
SELECT email, created_at FROM auth.users ORDER BY created_at DESC;
```

