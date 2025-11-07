# ✅ Deallocate Fix Applied

## Problem
When deallocating an assignment, it showed "successful" but the assignment was still visible in the list.

## Root Cause
The `end_date` was set to today's date, but the query to fetch assignments filters with:
```sql
WHERE a.end_date IS NULL OR a.end_date >= CURRENT_DATE
```

So if `end_date` = today, the condition `end_date >= CURRENT_DATE` is still true, and the assignment remains visible.

## Solution
Changed the deallocate function to set `end_date` to **yesterday** instead of today, ensuring the condition `end_date >= CURRENT_DATE` is false.

## Code Changes
**File:** `src/components/ViewAssignedModal.tsx`

```javascript
// Before:
new Date().toISOString().split('T')[0]

// After:
const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
```

## Testing
To verify the fix:
1. Navigate to a project with assignments
2. Click "View Assigned"
3. Click "Deallocate" on an assignment
4. ✅ Assignment should disappear from the list immediately

## Technical Details
- Added `subDays` import from `date-fns`
- The deallocate operation now properly ends the assignment by setting it to yesterday
- Historical data is preserved (assignment is not deleted, just marked as ended)

