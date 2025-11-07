# Complete Supabase Removal Guide

## ✅ What's Been Removed

1. **Supabase Client** - Replaced with API client (`src/lib/api.ts`)
2. **Environment Variables** - `VITE_SUPABASE_URL` removed, using `VITE_API_URL` instead
3. **Docker Configuration** - Updated to use API URL instead of Supabase URL
4. **Core Components** - Login, Dashboard, AppSidebar, Notifications all use API now

## ⚠️ Files Still Using Supabase (Need Migration)

These files still have Supabase imports and need to be migrated:

### High Priority (Active Pages):
- `src/pages/Settings.tsx` - Uses supabase.storage and supabase.from()
- `src/pages/LeaveRequests.tsx` - Uses supabase.from() extensively
- `src/pages/Timesheets.tsx` - Uses supabase.from()
- `src/pages/ShiftManagement.tsx` - Uses supabase.functions.invoke() and supabase.from()
- `src/pages/Analytics.tsx` - Uses supabase.from()
- `src/pages/Appraisals.tsx` - Uses supabase.from()
- `src/pages/Onboarding.tsx` - Uses supabase.from()
- `src/pages/OnboardingTracker.tsx` - Uses supabase.from()
- `src/pages/LeavePolicies.tsx` - Uses supabase.from()
- `src/pages/ChangePassword.tsx` - Uses supabase.auth.updateUser()
- `src/pages/MyAppraisal.tsx` - Uses supabase.from()

### Components:
- `src/components/org-chart/OrgChart.tsx` - Uses supabase.from()
- `src/components/org-chart/EnhancedOrgChart.tsx` - Uses supabase.from()

## 🔧 How to Fix

### Step 1: Check Browser Console
When you see a 406 error, check the browser console - it will show which component is trying to import Supabase.

### Step 2: Replace Supabase Calls

**Before:**
```typescript
import { supabase } from "@/integrations/supabase/client";
const { data } = await supabase.from('table').select('*');
```

**After:**
```typescript
import { api } from "@/lib/api";
const data = await api.getTableName(); // Or create new API method
```

### Step 3: Add API Endpoints

If a page needs data that doesn't have an API endpoint yet, add it to `server/routes/`:

```javascript
// server/routes/new-route.js
import express from 'express';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/endpoint', authenticateToken, async (req, res) => {
  // Your database query here
});

export default router;
```

Then add to `server/index.js`:
```javascript
app.use('/api/new-route', newRoute);
```

## 🚀 Current Status

✅ **Working:**
- Authentication (Login, Signup)
- Employee Management
- Dashboard (basic stats)
- Notifications
- Organization info
- AppSidebar

⚠️ **Needs Migration:**
- All pages listed above
- File uploads (Settings page)
- Real-time features (now using polling)

## 🛠️ Quick Fix

If you just want to stop Supabase errors immediately:

1. **Hard refresh your browser** (Ctrl+Shift+R or Cmd+Shift+R)
2. **Clear browser cache**
3. The Supabase client now throws errors - check browser console for which component needs fixing

The app will show errors in the console for any component still trying to use Supabase, making it easy to identify what needs to be fixed.

