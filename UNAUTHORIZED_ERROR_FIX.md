# Fixed: UNAUTHORIZED Error in Device Registration and Audit Logs

## Problem

Users were seeing "UNAUTHORIZED" errors when accessing:
- Registered Device (1 PC) section
- Audit Logs section

## Root Cause

The authentication cookies (`pp_tenant`, `pp_user`, `pp_role`, `pp_email`) were not set, causing `getSessionUser()` to return `null`, which triggered the UNAUTHORIZED error.

## Solution Applied

### 1. Development Fallback in Auth (`src/lib/auth.ts`)

Added automatic cookie setting in development mode:
- If cookies are missing in development, automatically:
  - Finds or creates a default tenant
  - Sets authentication cookies
  - Returns user session

This allows the app to work immediately in development without manual cookie setup.

### 2. Improved Error Handling

**API Endpoints:**
- `/api/licensing/device` - Better error messages
- `/api/licensing/ip` - Better error messages  
- `/api/licensing/audit` - Better error messages
- `/api/security/audit` - Graceful handling when no roles assigned

**UI Components:**
- Settings page now shows helpful messages instead of just errors
- "Refresh Page" button when authentication fails
- Loading states for better UX

### 3. RBAC Auto-Assignment

If a user has no roles assigned:
- Automatically assigns default role based on auth role (OWNER for owner/super_admin)
- Only in development mode
- Happens on first access

## How It Works Now

### Development Mode
1. User accesses page
2. If cookies missing → Auto-create default tenant
3. Auto-set cookies
4. Auto-assign OWNER role (if owner/super_admin)
5. Everything works!

### Production Mode
1. User must be properly authenticated
2. Cookies must be set by login system
3. Roles must be assigned by admin

## Testing

1. **Clear browser cookies** (to simulate the issue)
2. **Refresh the page**
3. **Go to Settings → Security & Licensing**
4. **Should see**: Device registration working (no UNAUTHORIZED error)
5. **Go to Settings → Security**
6. **Should see**: Audit logs loading (no UNAUTHORIZED error)

## If Still Seeing Errors

1. **Hard refresh**: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. **Check browser console**: Look for cookie-related errors
3. **Check network tab**: Verify API responses
4. **Verify database**: Ensure tenant exists
5. **Check environment**: Ensure `NODE_ENV=development` for auto-setup

## Files Changed

- `src/lib/auth.ts` - Added development fallback
- `src/lib/security/rbac.ts` - Added auto-role assignment
- `src/app/api/licensing/device/route.ts` - Better error handling
- `src/app/api/licensing/ip/route.ts` - Better error handling
- `src/app/api/licensing/audit/route.ts` - Better error handling
- `src/app/api/security/audit/route.ts` - Graceful RBAC handling
- `src/app/settings/page.tsx` - Better UI error handling

## Next Steps

For production, ensure:
1. Proper authentication system sets cookies on login
2. Roles are assigned to users
3. Environment variables are configured
4. CORS is properly set up

The development fallback makes testing easier, but production should use proper authentication.
