# Debug Steps for Timesheet Approvals Visibility

## Check Your Current Role

1. Open browser console (F12)
2. Type: `localStorage.getItem('auth_token')` - check if token exists
3. Look at the network tab when page loads - check what API calls are made
4. Check the console for any errors

## Direct URL Test

Try navigating directly to:
- http://localhost:3000/timesheet-approvals

If this works, the route is fine and it's a sidebar visibility issue.

## Manual Role Check

In browser console:
```javascript
// Check what's in localStorage
console.log(localStorage.getItem('auth_token'));

// Check current user role (if AuthContext exposes it)
// Look in React DevTools -> Components -> AuthProvider -> userRole
```

## Current Database Roles

Run this to check:
```bash
docker-compose exec postgres psql -U postgres -d hr_suite -c "SELECT p.email, ur.role FROM profiles p LEFT JOIN user_roles ur ON ur.user_id = p.id;"
```

