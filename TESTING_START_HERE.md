# 🚀 Start Here: Testing Enterprise Licence Features

## ✅ Quick Start (5 Minutes)

### Step 1: Run Database Migration (REQUIRED!)
```bash
cd pharmapulse-next
npx prisma migrate dev --name add_enterprise_licence_features
npx prisma generate
```

### Step 2: Start Dev Server
```bash
npm run dev
```

### Step 3: Access Security & Licensing Tab
1. Go to: `http://localhost:3000/settings`
2. Look at the **LEFT SIDEBAR**
3. Click the **4th tab**: **🔒 Security & Licensing**

### Step 4: Verify It's Working
You should see:
- ✅ Blue gradient "Licence Status" panel
- ✅ "Registered Device" section
- ✅ "Allowed IP Address" section
- ✅ "Audit Logs" section

---

## 📍 Where is the Tab?

### Location in Settings Page:

```
┌─────────────────────────────────────────┐
│ Settings                                │
├──────────────┬──────────────────────────┤
│              │                          │
│  SIDEBAR     │     CONTENT              │
│  (Left)      │     (Right)              │
│              │                          │
│  👤 Profile  │                          │
│  🔔 Notif... │                          │
│  🛡️ Security │                          │
│  🔒 Security │  ← CLICK THIS TAB        │
│     &        │                          │
│  Licensing   │                          │
│  💳 Billing  │                          │
│  ⚙️ General  │                          │
│              │                          │
└──────────────┴──────────────────────────┘
```

**The tab is the 4th item in the LEFT SIDEBAR** with:
- **Icon**: 🔒 Lock icon
- **Label**: "Security & Licensing"

---

## 🐛 Troubleshooting

### Issue: Can't See the Tab

**Solution 1: Clear Cache and Restart**
```bash
# Stop dev server (Ctrl+C)
rm -rf .next
npm run dev
```

**Solution 2: Verify Tab Exists in Code**
```bash
# The tab should be at line 566
grep -n "licensing" src/app/settings/page.tsx
# Should show: 566:    { id: 'licensing', label: 'Security & Licensing', icon: Lock },
```

**Solution 3: Check Browser Console**
- Press F12
- Go to Console tab
- Look for errors
- Refresh page: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

**Solution 4: Run Migration First**
```bash
# This is REQUIRED before testing!
npx prisma migrate dev --name add_enterprise_licence_features
npx prisma generate
```

---

## ✅ Quick Test Checklist

Once you can see the tab, verify:

- [ ] Tab is visible and clickable
- [ ] Page loads without errors
- [ ] "Licence Status Panel" is visible (blue background)
- [ ] Status badge shows (Active/Expired/Pending)
- [ ] Days Remaining is displayed
- [ ] "Registered Device" section shows
- [ ] "Allowed IP Address" section shows
- [ ] "Audit Logs" section shows
- [ ] Export buttons (PDF/CSV) are visible

---

## 🧪 Basic Feature Tests

### Test 1: View Page ✅
- **Action:** Click "Security & Licensing" tab
- **Expected:** Page loads, all sections visible

### Test 2: Register Device 💻
- **Action:** Click "Register This Device" button
- **Expected:** Device registered, shows OS/Browser info

### Test 3: Request IP Change 🌐
- **Action:** Click "Request IP Change" button
- **Expected:** Modal opens, ask for IP and reason

### Test 4: Export CSV 📥
- **Action:** Click "CSV" button in Audit Logs
- **Expected:** CSV file downloads

---

## 📚 Detailed Testing Guides

Once you can access the tab, see:

1. **`TESTING_GUIDE_ENTERPRISE_LICENCE.md`** - Complete testing guide
   - Test grace period
   - Test read-only mode
   - Test violations
   - Test all features

2. **`QUICK_TEST_GUIDE.md`** - Quick reference
   - Step-by-step instructions
   - Troubleshooting tips

3. **`HOW_TO_FIND_SECURITY_LICENSING_TAB.md`** - Visual guide
   - Screenshots and layout diagrams
   - Common issues

---

## 🎯 What to Test

1. ✅ **Licence Status Panel**
   - Status badge
   - Days remaining
   - Last validation
   - Access level

2. ✅ **Grace Period**
   - Orange banner when expired (in grace)
   - Days remaining shown

3. ✅ **Read-Only Mode**
   - Red banner when expired (outside grace)
   - Limited access explained

4. ✅ **Warning Banner**
   - Yellow banner when <30 days remaining
   - "Expiring Soon" status

5. ✅ **Device Registration**
   - OS and Browser info displayed
   - Registration timestamp

6. ✅ **IP Change Request**
   - Reason required (min 10 chars)
   - Status tracking

7. ✅ **Renewal Request**
   - Button generates renewal code
   - Code displayed

8. ✅ **Violation Alerts**
   - Shows last 5 violations
   - Details and timestamps

9. ✅ **Export Functionality**
   - CSV export works
   - PDF export (JSON format)

---

## 📞 Need Help?

### Check Browser Console:
1. Press F12
2. Go to Console tab
3. Look for errors

### Check Server Logs:
1. Look at terminal where `npm run dev` is running
2. Check for Prisma or API errors

### Check Database:
```bash
npx prisma studio
# Verify licenses table has data
```

### Test API Directly:
```bash
curl http://localhost:3000/api/licensing/licence
```

---

## ✅ Success Criteria

You'll know everything is working when:

1. ✅ Can see "Security & Licensing" tab
2. ✅ Can click tab and page loads
3. ✅ All sections visible (Status, Device, IP, Logs)
4. ✅ No errors in browser console
5. ✅ No errors in server logs
6. ✅ Can click buttons (Register, Request IP, Export)
7. ✅ Data displays correctly

---

## 🚀 Next Steps

Once you can see the page:

1. ✅ Run basic tests (see above)
2. ✅ Test grace period (see detailed guide)
3. ✅ Test read-only mode (see detailed guide)
4. ✅ Test violations (see detailed guide)
5. ✅ Test all features (see detailed guide)

---

**Remember:** Run the migration first! This is required before you can see/test the features.

```bash
npx prisma migrate dev --name add_enterprise_licence_features
npx prisma generate
```

---

**Good luck! 🎉**
