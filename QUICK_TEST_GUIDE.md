# Quick Test Guide: Security & Licensing Features

## 🚀 Step 1: Run Database Migration (REQUIRED)

First, you must run the database migration to add the new fields:

```bash
cd pharmapulse-next

# Run migration
npx prisma migrate dev --name add_enterprise_licence_features

# Generate Prisma client
npx prisma generate

# (Optional) Open Prisma Studio to verify
npx prisma studio
```

**If migration fails**, you might need to create the migration manually or reset:

```bash
# Reset database (WARNING: Deletes all data!)
npx prisma migrate reset

# Or create migration manually
npx prisma migrate dev --create-only --name add_enterprise_licence_features
```

---

## 🔍 Step 2: Access Security & Licensing Tab

### Option A: Via Web Browser
1. **Start your dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to Settings:**
   - Go to: `http://localhost:3000/settings`
   - Or click **"Settings"** in the sidebar (gear icon)

3. **Find the "Security & Licensing" tab:**
   - In the **left sidebar** of the Settings page
   - It's the **4th tab** (after Profile, Notifications, Security)
   - Look for the tab with **🔒 Lock icon** and label **"Security & Licensing"**

### Option B: Direct URL
Try accessing directly:
- `http://localhost:3000/settings?tab=licensing`

---

## 🐛 Troubleshooting: Can't See the Tab

### Issue 1: Tab Not Visible
**Check:**
1. Open browser console (F12)
2. Look for errors (red text)
3. Check if tabs are rendering:
   ```javascript
   // In browser console, run:
   document.querySelectorAll('[data-tab]') // Should show all tabs
   ```

**Solution:**
- Clear browser cache
- Restart dev server: `Ctrl+C` then `npm run dev`
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

### Issue 2: "UNAUTHORIZED" Error
**Check:**
1. Are you logged in?
2. Check browser cookies (DevTools → Application → Cookies)

**Solution:**
- Log out and log back in
- Check session/auth middleware is working

### Issue 3: Blank Page or Loading Forever
**Check:**
1. Check browser console for API errors
2. Test API endpoints:
   ```bash
   curl http://localhost:3000/api/licensing/licence
   ```

**Solution:**
- Verify database connection
- Check Prisma client is generated: `npx prisma generate`
- Restart dev server

---

## ✅ Step 3: Quick Visual Check

Once you're on the Security & Licensing page, you should see:

### Top Section: Licence Status Panel
- ✅ Blue gradient background
- ✅ "Licence Status" heading with Lock icon
- ✅ Status badge (Active/Expired/Pending Renewal)
- ✅ Licence Key (masked, with Copy button)
- ✅ Expiration Date
- ✅ Days Remaining (color-coded)
- ✅ Licence Type: "1 PC / 1 IP / Annual"
- ✅ Last Validation timestamp
- ✅ Access Level badge

### Middle Sections:
- ✅ **Registered Device (1 PC)** - Device info with OS/Browser
- ✅ **Allowed IP Address** - IP management with request button

### Bottom Sections:
- ✅ **Licence Violation Alerts** (if violations exist)
- ✅ **Licence Audit Logs** - With PDF/CSV export buttons

---

## 🧪 Step 4: Basic Tests

### Test 1: View Page ✅
- **Action:** Click "Security & Licensing" tab
- **Expected:** Page loads, all sections visible

### Test 2: Check Licence Status ✅
- **Action:** Look at "Licence Status Panel"
- **Expected:** Status, expiry date, days remaining shown

### Test 3: Register Device 💻
- **Action:** Click "Register This Device" (if not registered)
- **Expected:** Device registered, OS/Browser info displayed

### Test 4: View Device Info 💻
- **Action:** Check "Registered Device" section
- **Expected:** Shows OS (Windows/macOS/Linux), Browser (Chrome/Firefox), registration date

### Test 5: Request IP Change 🌐
- **Action:** Click "Request IP Change" button
- **Expected:** Modal opens, ask for IP and reason (min 10 chars)

### Test 6: Export CSV 📥
- **Action:** Click "CSV" button in Audit Logs section
- **Expected:** CSV file downloads

---

## 📊 Step 5: Test Advanced Features

### Test Grace Period ⏰

1. **Set licence to expired:**
   ```sql
   -- In Prisma Studio or database client:
   UPDATE licenses 
   SET expires_at = NOW() - INTERVAL '5 days',
       status = 'expired'
   WHERE tenant_id = 'your-tenant-id';
   ```

2. **Refresh page:**
   - You should see **orange banner**: "Grace Period Active"
   - Shows days remaining in grace period

### Test Read-Only Mode 📖

1. **Set licence outside grace period:**
   ```sql
   UPDATE licenses 
   SET expires_at = NOW() - INTERVAL '10 days',
       status = 'expired',
       grace_until = NOW() - INTERVAL '3 days'
   WHERE tenant_id = 'your-tenant-id';
   ```

2. **Refresh page:**
   - You should see **red banner**: "Read-Only Mode"
   - Message explains limited access

### Test Warning Banner ⚠️

1. **Set licence expiring soon:**
   ```sql
   UPDATE licenses 
   SET expires_at = NOW() + INTERVAL '15 days',
       status = 'active'
   WHERE tenant_id = 'your-tenant-id';
   ```

2. **Refresh page:**
   - You should see **yellow banner**: "Licence Expiring Soon"
   - Status shows "Expiring Soon"

### Test Violations 🚨

1. **Trigger a violation:**
   - Register a device
   - Clear cookies or use different browser
   - Try to access app (should fail)

2. **Check violations:**
   - Go to Security & Licensing page
   - Scroll to "Licence Violation Alerts"
   - Should show violation details

---

## 🎯 Quick Test Checklist

Run through this checklist to verify everything works:

- [ ] Can access Settings page
- [ ] Can see "Security & Licensing" tab (4th tab, Lock icon)
- [ ] Tab is clickable
- [ ] Page loads without errors
- [ ] Licence Status Panel is visible
- [ ] Status badge shows (Active/Expired/Pending)
- [ ] Days Remaining is displayed
- [ ] Licence Type shows "1 PC / 1 IP / Annual"
- [ ] Last Validation timestamp shown
- [ ] Access Level badge visible
- [ ] Device section shows OS/Browser info
- [ ] IP section shows current/allowed IP
- [ ] "Request IP Change" button works (opens modal)
- [ ] Export buttons (PDF/CSV) are visible
- [ ] Audit Logs section loads

---

## 🚨 If Tab Still Not Visible

### Step 1: Check Code
```bash
# Verify tab is in the code
grep -n "licensing" src/app/settings/page.tsx
# Should show line 566 with the tab definition
```

### Step 2: Check Build Errors
```bash
# Build the project to check for errors
npm run build
```

### Step 3: Clear Everything
```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules
npm install

# Regenerate Prisma client
npx prisma generate

# Restart dev server
npm run dev
```

### Step 4: Check Browser
- Try different browser (Chrome, Firefox, Safari)
- Disable browser extensions
- Try incognito/private mode

---

## 📞 Need More Help?

1. **Check Browser Console:**
   - Open DevTools (F12)
   - Look at Console tab for errors
   - Look at Network tab for failed API calls

2. **Check Server Logs:**
   - Look at terminal where `npm run dev` is running
   - Check for Prisma errors or API errors

3. **Check Database:**
   ```bash
   npx prisma studio
   # Verify licenses table exists and has data
   ```

4. **Test API Directly:**
   ```bash
   # Test licence API
   curl http://localhost:3000/api/licensing/licence
   
   # Test device API
   curl http://localhost:3000/api/licensing/device
   ```

---

## ✅ Success Indicators

You'll know it's working when you can:

1. ✅ See the "Security & Licensing" tab in Settings
2. ✅ Click it and page loads
3. ✅ See all sections (Status, Device, IP, Logs)
4. ✅ See licence information displayed
5. ✅ Can click buttons (Register, Request IP, Export)
6. ✅ No errors in browser console
7. ✅ No errors in server logs

---

**Next Steps:** Once you can see the page, follow the detailed testing guide in `TESTING_GUIDE_ENTERPRISE_LICENCE.md` for comprehensive feature testing.
