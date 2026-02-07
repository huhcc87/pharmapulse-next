# 🚀 Start Testing Now - Step by Step

## ⚠️ IMPORTANT: Run These Commands Manually

Since Prisma migrate is interactive, you need to run these commands in your terminal:

---

## Step 1: Apply Pending Migration First

```bash
# Make sure you're in the pharmapulse-next directory
cd /Users/mudasirrashid/Documents/Idea-Development-Pharmapl/pharmapulse-next

# Apply pending migrations first
npx prisma migrate dev
```

This will:
- Apply the pending `20251224171649_drug_library_init` migration
- Ask if you want to create a new migration for the enterprise licence features
- Type `y` or press Enter to create the new migration

---

## Step 2: Create Enterprise Licence Features Migration

After the pending migration is applied, Prisma will detect schema changes and ask:

```
? Enter a name for the new migration: 
```

Type: `add_enterprise_licence_features`

Then press Enter.

---

## Step 3: Generate Prisma Client

```bash
npx prisma generate
```

This generates the Prisma client with the new fields.

---

## Step 4: Verify Migration

```bash
# Check migration status
npx prisma migrate status

# Or open Prisma Studio to see the database
npx prisma studio
```

In Prisma Studio, check:
- `License` table should have new columns: `grace_period_days`, `grace_until`, `last_validated_at`, etc.
- `LicenseViolation` table should exist
- `DeviceRegistration` should have `operatingSystem`, `browser` columns
- `IpChangeRequest` should have `reason` column

---

## Step 5: Start Dev Server

```bash
npm run dev
```

Wait for the server to start (usually at `http://localhost:3000`)

---

## Step 6: Access Security & Licensing Tab

1. **Open browser:** Go to `http://localhost:3000/settings`

2. **Find the tab:**
   - Look at the **LEFT SIDEBAR** (not top)
   - Find the **4th tab** from the top
   - It has a **🔒 Lock icon** and label **"Security & Licensing"**

3. **Click the tab**

---

## Step 7: Verify Everything Works

You should see:

### ✅ Licence Status Panel (Blue gradient background)
- Status badge (Active/Expired/Pending)
- Licence Key (masked)
- Expiration Date
- Days Remaining (color-coded)
- **Licence Type**: "1 PC / 1 IP / Annual"
- **Last Validation**: Timestamp
- **Access Level**: Badge

### ✅ Registered Device Section
- Device information
- **Operating System** (Windows/macOS/Linux)
- **Browser** (Chrome/Firefox/Safari)
- Registration timestamp

### ✅ Allowed IP Address Section
- Current IP
- Allowed IP
- **"Request IP Change"** button (opens modal)

### ✅ Licence Violation Alerts (if violations exist)
- Shows last 5 violations
- Violation type, reason, timestamp

### ✅ Audit Logs Section
- Recent audit logs
- **PDF** export button
- **CSV** export button

---

## 🧪 Quick Tests

### Test 1: Register Device
1. Click **"Register This Device"** button
2. Should see device registered
3. Should see OS and Browser info displayed

### Test 2: Request IP Change
1. Click **"Request IP Change"** button
2. Modal should open
3. Enter new IP (e.g., `192.168.1.100`)
4. Enter reason (minimum 10 characters)
5. Click **"Submit Request"**
6. Should see "Request Pending" status

### Test 3: Export CSV
1. Scroll to **"Licence Audit Logs"** section
2. Click **"CSV"** button
3. CSV file should download

---

## 🐛 Troubleshooting

### Can't See the Tab?

1. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   npm run dev
   ```

2. **Hard refresh browser:**
   - Windows: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

3. **Check browser console (F12):**
   - Look for errors in Console tab
   - Check Network tab for failed API calls

### Getting "UNAUTHORIZED" Error?

1. **Check if you're logged in**
2. **Check session cookies:**
   - DevTools → Application → Cookies
   - Should see session cookies

### Migration Errors?

1. **Check database connection:**
   ```bash
   # Test database connection
   npx prisma db pull
   ```

2. **Check .env file:**
   ```bash
   # Verify DATABASE_URL is set
   cat .env | grep DATABASE_URL
   ```

---

## ✅ Success Checklist

- [ ] Migration applied successfully
- [ ] Prisma client generated
- [ ] Dev server running
- [ ] Can see Settings page
- [ ] Can see "Security & Licensing" tab (4th tab in sidebar)
- [ ] Can click tab and page loads
- [ ] Licence Status Panel visible
- [ ] All sections visible (Device, IP, Logs)
- [ ] No errors in browser console
- [ ] Can click buttons (Register, Request IP, Export)

---

## 📚 Next Steps

Once you can see the page, test all features:

1. See `TESTING_GUIDE_ENTERPRISE_LICENCE.md` for detailed tests
2. See `QUICK_TEST_GUIDE.md` for quick reference
3. See `HOW_TO_FIND_SECURITY_LICENSING_TAB.md` for visual guide

---

## 🎯 What to Test

1. ✅ **Basic Page Load** - All sections visible
2. ✅ **Device Registration** - Register device, see OS/Browser
3. ✅ **IP Change Request** - Request IP change with reason
4. ✅ **Export Functions** - Export CSV/PDF
5. ✅ **Grace Period** - Set expiry to past (see orange banner)
6. ✅ **Read-Only Mode** - Set expiry outside grace (see red banner)
7. ✅ **Warning Banner** - Set expiry <30 days (see yellow banner)
8. ✅ **Violations** - Trigger violations, see alerts
9. ✅ **Renewal Request** - Request renewal, see code

---

**Good luck! 🎉**

If you encounter any issues, check the troubleshooting section or review the detailed testing guides.
