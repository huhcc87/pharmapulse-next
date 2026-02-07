# Troubleshooting: "You're Offline" Error

## Issue
Seeing "You're Offline" message when visiting `/dev/env` or other pages.

## Root Cause
The dev server is not running, so the browser can't connect to `localhost:3000`.

## Solution

### Step 1: Start the Dev Server

```bash
cd pharmapulse-next
npm run dev
```

**Expected output:**
```
✓ Ready in 2.3s
○ Local:        http://localhost:3000
```

### Step 2: Clear Browser Cache (If Issue Persists)

If you still see the offline message after starting the server:

1. **Hard Refresh:**
   - Chrome/Edge: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Firefox: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)
   - Safari: `Cmd+Option+R`

2. **Clear Service Worker Cache:**
   - Open DevTools (F12)
   - Go to **Application** tab → **Service Workers**
   - Click **Unregister** if any service workers are registered
   - Go to **Application** → **Storage** → **Clear site data**

3. **Check Browser Offline Mode:**
   - Chrome: Check if airplane mode is on (check system tray)
   - Make sure you're connected to the internet

### Step 3: Verify Connection

```bash
# Test health endpoint
curl http://localhost:3000/api/supabase/health

# Expected response:
{
  "status": "healthy",
  "message": "Supabase is properly configured",
  ...
}
```

### Step 4: Test Environment Variables

Visit in browser: `http://localhost:3000/dev/env`

**Expected:**
- ✅ Green checkmarks for both variables
- ✅ "Configured ✓" status
- ✅ Supabase URL host shown

---

## Common Issues

### Issue 1: Port 3000 Already in Use

**Error:** `Port 3000 is already in use`

**Solution:**
```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)

# Or use different port
PORT=3001 npm run dev
```

### Issue 2: Environment Variables Not Loading

**Symptom:** Variables show as missing even though `.env.local` exists

**Solution:**
1. Verify `.env.local` is in project root (same level as `package.json`)
2. Restart dev server after adding variables
3. Check for typos in variable names (case-sensitive!)
4. Make sure no spaces around `=` sign

### Issue 3: Service Worker Caching Offline Page

**Symptom:** Page shows offline even when server is running

**Solution:**
1. Open DevTools (F12)
2. Application → Service Workers → Unregister
3. Application → Storage → Clear site data
4. Hard refresh the page

### Issue 4: Browser Offline Detection

**Symptom:** Browser thinks it's offline

**Solution:**
1. Check system network settings
2. Disable airplane mode
3. Check firewall settings
4. Try different browser

---

## Quick Verification Checklist

- [ ] ✅ Dev server is running (`npm run dev`)
- [ ] ✅ Server shows "Ready" message
- [ ] ✅ Can access `http://localhost:3000` in browser
- [ ] ✅ `.env.local` exists in project root
- [ ] ✅ Environment variables are set correctly
- [ ] ✅ Browser cache cleared
- [ ] ✅ Service worker unregistered (if exists)
- [ ] ✅ Internet connection is working

---

## Still Not Working?

1. **Check server logs** for errors
2. **Verify environment variables:**
   ```bash
   npm run check:env
   ```
3. **Test Supabase connection:**
   ```bash
   curl http://localhost:3000/api/supabase/health
   ```
4. **Check browser console** (F12) for JavaScript errors
5. **Try incognito/private mode** to rule out extensions

---

**Status:** ✅ Resolved after restarting dev server
