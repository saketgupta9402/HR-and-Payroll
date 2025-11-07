# Clear Browser Cache - Fix Supabase Errors

If you're still seeing Supabase errors, your browser has cached the old JavaScript files.

## Quick Fix

1. **Hard Refresh** (most important):
   - **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`
   - **Mac**: `Cmd + Shift + R`

2. **Clear Browser Cache**:
   - Open DevTools (F12)
   - Right-click the refresh button
   - Select "Empty Cache and Hard Reload"

3. **Or Clear Cache Manually**:
   - **Chrome/Edge**: Settings → Privacy → Clear browsing data → Cached images and files
   - **Firefox**: Settings → Privacy → Clear Data → Cached Web Content

4. **Or Use Incognito/Private Window**:
   - Open a new incognito/private window
   - Go to http://localhost:3000
   - This uses a fresh cache

## Verify It Worked

After clearing cache, check:
- No Supabase errors in console
- No 406 errors to `oopgvhkegreimslgqypl.supabase.co`
- Pages load correctly

## If Still Seeing Errors

The errors should show which file is still using Supabase. Check the console stack trace.

