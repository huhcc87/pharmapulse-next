# How to Find Security & Licensing Tab

## 📍 Location

The **Security & Licensing** tab is located in the **Settings** page.

### Step-by-Step Access:

1. **Open the Application:**
   - Go to: `http://localhost:3000`
   - Make sure you're logged in

2. **Navigate to Settings:**
   - Click **"Settings"** in the left sidebar (gear icon ⚙️)
   - Or go directly to: `http://localhost:3000/settings`

3. **Find the Tab:**
   - On the Settings page, look at the **LEFT SIDEBAR** (not top tabs)
   - You'll see a vertical list of tabs:
     - 👤 Profile
     - 🔔 Notifications  
     - 🛡️ Security
     - **🔒 Security & Licensing** ← **THIS IS THE TAB**
     - 💳 Billing
     - ⚙️ General

4. **Click the Tab:**
   - Click on **"Security & Licensing"** (4th item in the sidebar)
   - The tab has a **Lock icon** 🔒 and label **"Security & Licensing"**

---

## 🖼️ Visual Guide

```
Settings Page Layout:

┌─────────────────────────────────────────────────────┐
│                    Settings                         │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│  Sidebar     │        Content Area                  │
│              │                                      │
│  👤 Profile  │                                      │
│  🔔 Notif..  │                                      │
│  🛡️ Security │                                      │
│  🔒 Security │  ← Click here!                       │
│     &        │                                      │
│  Licensing   │                                      │
│  💳 Billing  │                                      │
│  ⚙️ General  │                                      │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

---

## ✅ What You Should See

After clicking the **Security & Licensing** tab, you should see:

1. **Licence Status Panel** (blue gradient background)
   - Status badge
   - Licence Key (masked)
   - Expiration Date
   - Days Remaining
   - Last Validation
   - Access Level

2. **Registered Device (1 PC)** section
   - Device information
   - OS and Browser details
   - Registration buttons

3. **Allowed IP Address** section
   - Current IP
   - IP change request button

4. **Licence Violation Alerts** section (if violations exist)

5. **Licence Audit Logs** section
   - Export buttons (PDF/CSV)

---

## 🚨 If You Still Can't See It

### Check 1: Is the tab rendered?
Open browser console (F12) and run:
```javascript
// Check if tab exists
document.querySelectorAll('button').forEach(btn => {
  if (btn.textContent.includes('Licensing')) {
    console.log('Found:', btn);
  }
});
```

### Check 2: Is there a build error?
```bash
# Check if app builds
npm run build

# Check for TypeScript errors
npx tsc --noEmit
```

### Check 3: Run database migration
```bash
# CRITICAL: Run this first!
npx prisma migrate dev --name add_enterprise_licence_features
npx prisma generate
```

### Check 4: Clear cache and restart
```bash
# Stop dev server (Ctrl+C)
# Clear cache
rm -rf .next
# Restart
npm run dev
```

---

## 🔍 Alternative: Direct URL

Try accessing directly via URL:
```
http://localhost:3000/settings?tab=licensing
```

Or programmatically:
```javascript
// In browser console:
window.location.href = '/settings';
setTimeout(() => {
  // Manually trigger tab click after page loads
  const licensingTab = Array.from(document.querySelectorAll('button')).find(
    btn => btn.textContent.includes('Licensing')
  );
  if (licensingTab) licensingTab.click();
}, 1000);
```

---

## 📝 Quick Checklist

- [ ] I can see the Settings page
- [ ] I can see the left sidebar with tabs
- [ ] I can see "Profile", "Notifications", "Security" tabs
- [ ] I can see "Security & Licensing" tab (4th tab)
- [ ] I can click on "Security & Licensing" tab
- [ ] The page loads without errors
- [ ] I can see "Licence Status Panel"

---

## 🎯 Expected Result

When you click the **Security & Licensing** tab, you should see:

✅ Page title: "Security & Licensing"  
✅ Blue gradient licence status panel  
✅ Device registration section  
✅ IP management section  
✅ Audit logs section  
✅ Export buttons  

If you see all these, **you're in the right place!** 🎉

---

## 📞 Still Having Issues?

1. **Check the file exists:**
   ```bash
   # The tab is defined at line 566 in settings page
   grep -n "licensing" src/app/settings/page.tsx
   ```

2. **Check for runtime errors:**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Look for red error messages

3. **Verify API endpoints work:**
   ```bash
   curl http://localhost:3000/api/licensing/licence
   ```

4. **Check if migration ran:**
   ```bash
   npx prisma studio
   # Check if licenses table has new columns
   ```

---

**The tab IS there - it's just a matter of finding it!** Look for the 4th item in the Settings sidebar with the Lock icon 🔒.
