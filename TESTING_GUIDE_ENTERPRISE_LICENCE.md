# Testing Guide: Enterprise Licence Features

## 📋 How to Access Security & Licensing Page

1. **Start your development server:**
   ```bash
   cd pharmapulse-next
   npm run dev
   ```

2. **Navigate to Settings:**
   - Go to `http://localhost:3000/settings`
   - Or click "Settings" in the sidebar

3. **Access Security & Licensing Tab:**
   - In the Settings page, click on the **"Security & Licensing"** tab
   - It should be the 4th tab (after Profile, Notifications, Security)
   - The tab icon is a 🔒 Lock icon

## ✅ Prerequisites

Before testing, ensure:

1. **Database Migration:**
   ```bash
   cd pharmapulse-next
   npx prisma migrate dev --name add_enterprise_licence_features
   npx prisma generate
   ```

2. **You are logged in** as an authenticated user

3. **Environment Variables** (if using admin endpoints):
   ```bash
   ADMIN_MASTER_CODE=your-secret-code
   ADMIN_MASTER_SECRET=your-secret-key
   LICENCE_KEY_SECRET=your-licence-secret
   RENEWAL_CODE_SECRET=your-renewal-secret
   ```

---

## 🧪 Test Scenarios

### Test 1: View Security & Licensing Page ✅

**Steps:**
1. Go to `http://localhost:3000/settings`
2. Click on **"Security & Licensing"** tab
3. Verify you see:
   - Licence Status Panel (top section)
   - Registered Device (1 PC) section
   - Allowed IP Address section
   - Licence Violation Alerts (if any)
   - Audit Logs section

**Expected Result:**
- Page loads without errors
- All sections are visible
- Status information is displayed

---

### Test 2: Test Grace Period ⏰

**Setup:**
1. Access the database directly or use Prisma Studio:
   ```bash
   npx prisma studio
   ```

2. Find your licence record in the `licenses` table

3. Set expiry date to the past:
   ```sql
   UPDATE licenses 
   SET expires_at = NOW() - INTERVAL '5 days',
       status = 'expired'
   WHERE tenant_id = 'your-tenant-id';
   ```

**Steps:**
1. Refresh the Security & Licensing page
2. Verify:
   - **Grace Period Banner** appears (orange banner)
   - Shows "Grace Period Active"
   - Displays days remaining in grace period
   - Status shows "Expired" but access is allowed

**Expected Result:**
- Grace period banner visible
- Read-only mode active
- Days remaining shown correctly

---

### Test 3: Test Read-Only Mode 📖

**Setup:**
1. Ensure licence is expired (outside grace period):
   ```sql
   UPDATE licenses 
   SET expires_at = NOW() - INTERVAL '10 days',
       status = 'expired',
       grace_until = NOW() - INTERVAL '3 days'
   WHERE tenant_id = 'your-tenant-id';
   ```

**Steps:**
1. Refresh the Security & Licensing page
2. Verify:
   - **Read-Only Mode Banner** appears (red banner)
   - Shows "Read-Only Mode"
   - Message explains limited access

3. Try accessing protected routes (should work in read-only mode):
   - `/api/inventory` - Should allow GET (read)
   - `/api/pos` - Should block POST (write)
   - `/api/billing` - Should block POST (write)

**Expected Result:**
- Read-only banner visible
- Write operations blocked
- Read operations allowed

---

### Test 4: Test Violation Tracking 🚨

**Setup:**
1. Register a device and IP (Test 5)
2. Access from a different device/IP

**Steps:**
1. **Trigger Device Mismatch:**
   - Clear cookies or use a different browser
   - Try to access the application
   - Should see "DEVICE_MISMATCH" error

2. **Check Violations:**
   - Go to Security & Licensing page
   - Scroll to **"Licence Violation Alerts"** section
   - Verify violations are listed

**Expected Result:**
- Violations section visible
- Shows last 5 violations
- Displays violation type, reason, timestamp

**Verify via API:**
```bash
curl http://localhost:3000/api/licensing/violations?limit=5
```

---

### Test 5: Test Device Registration 💻

**Steps:**
1. Go to Security & Licensing page
2. Scroll to **"Registered Device (1 PC)"** section

3. **If no device registered:**
   - Click **"Register This Device"** button
   - Verify device is registered
   - Check OS and Browser info is displayed

4. **If device already registered:**
   - View device details:
     - Operating System (Windows/macOS/Linux)
     - Browser (Chrome/Firefox/Safari)
     - Registration timestamp
     - Last seen timestamp

5. **De-register Device:**
   - Click **"De-register Device"** button
   - Verify device is removed

**Expected Result:**
- Device registration works
- OS and Browser info displayed
- Device can be registered/deregistered

**Verify via API:**
```bash
# Get device status
curl http://localhost:3000/api/licensing/device

# Register device
curl -X POST http://localhost:3000/api/licensing/licence \
  -H "Content-Type: application/json" \
  -d '{"action": "register_device"}'
```

---

### Test 6: Test IP Change Requests 🌐

**Steps:**
1. Go to Security & Licensing page
2. Scroll to **"Allowed IP Address"** section

3. **View Current IP:**
   - See "Allowed IP" (registered IP)
   - See "Current IP" (your current IP)

4. **Request IP Change:**
   - Click **"Request IP Change"** button
   - Modal appears
   - Enter new IP (e.g., `192.168.1.100`)
   - Enter reason (minimum 10 characters)
   - Click **"Submit Request"**

5. **Check Request Status:**
   - Request status panel appears
   - Shows "⏳ IP Change Request Pending"
   - Displays reason and timestamp

**Expected Result:**
- IP change request created
- Status shows "Pending"
- Reason is displayed

**Verify via API:**
```bash
# Get IP status
curl http://localhost:3000/api/licensing/ip

# Request IP change
curl -X POST http://localhost:3000/api/licensing/ip \
  -H "Content-Type: application/json" \
  -d '{
    "action": "request",
    "ip": "192.168.1.100",
    "reason": "Moving to new location with different ISP"
  }'
```

---

### Test 7: Test Renewal Request 🔄

**Setup:**
1. Ensure licence is expired or expiring soon:
   ```sql
   UPDATE licenses 
   SET expires_at = NOW() + INTERVAL '20 days',
       status = 'active'
   WHERE tenant_id = 'your-tenant-id';
   ```

**Steps:**
1. Go to Security & Licensing page
2. Scroll to **"Licence Renewal"** section (appears when <30 days remaining or expired)

3. **Request Renewal:**
   - Click **"Request Renewal"** button
   - Renewal code is generated
   - Code is displayed in the section

4. **Copy Renewal Code:**
   - Click **"Copy"** button
   - Verify code is copied to clipboard

**Expected Result:**
- Renewal request created
- Renewal code displayed
- Code can be copied

**Verify via API:**
```bash
# Request renewal
curl -X POST http://localhost:3000/api/licensing/renewal-request \
  -H "Content-Type: application/json"
```

---

### Test 8: Test Export Functionality 📥

**Steps:**
1. Go to Security & Licensing page
2. Scroll to **"Licence Audit Logs"** section

3. **Export as CSV:**
   - Click **"CSV"** button
   - CSV file should download
   - Open in Excel/Numbers
   - Verify all data is present

4. **Export as PDF:**
   - Click **"PDF"** button
   - Should open PDF export (currently returns JSON)
   - Verify data structure

**Expected Result:**
- CSV export works
- PDF export returns data (JSON format)

**Verify via API:**
```bash
# Export CSV
curl http://localhost:3000/api/licensing/export/csv -o licence-export.csv

# Export PDF (JSON)
curl http://localhost:3000/api/licensing/export/pdf
```

---

### Test 9: Test Warning Banners ⚠️

**Setup:**
1. Set licence to expire soon (<30 days):
   ```sql
   UPDATE licenses 
   SET expires_at = NOW() + INTERVAL '15 days',
       status = 'active'
   WHERE tenant_id = 'your-tenant-id';
   ```

**Steps:**
1. Refresh Security & Licensing page
2. Verify:
   - **Warning Banner** appears (yellow banner)
   - Shows "Licence Expiring Soon"
   - Displays days remaining
   - Status shows "Expiring Soon"

**Expected Result:**
- Warning banner visible when <30 days remaining
- Status badge shows "Expiring Soon"

---

### Test 10: Test Status Panel Enhancements 📊

**Steps:**
1. Go to Security & Licensing page
2. Check **"Licence Status Panel"** shows:
   - Licence Key (masked)
   - Expiration Date
   - Days Remaining (color-coded)
   - **Licence Type**: "1 PC / 1 IP / Annual"
   - **Last Validation**: Timestamp
   - **Access Level**: Badge (Full/Read-Only/Blocked)
   - Subscriber ID

**Expected Result:**
- All status information displayed
- Last validation time shown
- Access level badge visible

---

## 🔍 Troubleshooting

### Issue: Can't See Security & Licensing Tab

**Solution:**
1. Check if you're logged in:
   ```bash
   # Check browser cookies
   # Look for session cookies
   ```

2. Verify the tab exists in code:
   ```bash
   # Search for "licensing" in settings page
   grep -n "licensing" src/app/settings/page.tsx
   ```

3. Check browser console for errors:
   - Open Developer Tools (F12)
   - Check Console tab for errors

### Issue: No Data Loading

**Solution:**
1. Check API endpoints:
   ```bash
   # Test API endpoints
   curl http://localhost:3000/api/licensing/licence
   ```

2. Check database connection:
   ```bash
   npx prisma studio
   ```

3. Verify authentication:
   - Ensure you're logged in
   - Check session cookies

### Issue: Grace Period Not Working

**Solution:**
1. Verify grace period fields in database:
   ```sql
   SELECT grace_period_days, grace_until, expires_at 
   FROM licenses 
   WHERE tenant_id = 'your-tenant-id';
   ```

2. Check grace period calculation:
   - Expiry date must be in past
   - Grace period should be 7 days (default)

### Issue: Violations Not Showing

**Solution:**
1. Verify violations exist:
   ```sql
   SELECT * FROM license_violations 
   WHERE tenant_id = 'your-tenant-id' 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

2. Check API response:
   ```bash
   curl http://localhost:3000/api/licensing/violations?limit=5
   ```

---

## 📝 Quick Test Checklist

- [ ] Can access Settings → Security & Licensing tab
- [ ] Licence Status Panel displays correctly
- [ ] Warning banner appears when <30 days remaining
- [ ] Grace period banner appears when expired
- [ ] Read-only mode banner appears after grace period
- [ ] Device registration works (OS/Browser displayed)
- [ ] IP change request works (reason required)
- [ ] Renewal request works (code generated)
- [ ] Violation alerts displayed (when violations exist)
- [ ] Export CSV works
- [ ] Export PDF returns data
- [ ] Status panel shows all information
- [ ] Last validation time displayed
- [ ] Access level badge displayed

---

## 🎯 Testing with Admin Endpoints

To test admin functions (renewal approval, etc.), use the admin API:

```bash
# List all licences
curl -X GET "http://localhost:3000/api/admin/licences" \
  -H "X-Admin-Code: your-admin-code" \
  -H "Authorization: Bearer your-admin-secret"

# Renew a licence
curl -X PATCH "http://localhost:3000/api/admin/licences?licenceId=licence-id/renew" \
  -H "X-Admin-Code: your-admin-code" \
  -H "Authorization: Bearer your-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "renewalCode": "RENEW-xxx"
  }'
```

---

## 📚 Additional Resources

- **API Documentation**: See `ADMIN_LICENCE_API_GUIDE.md`
- **Implementation Summary**: See `ENTERPRISE_FEATURES_IMPLEMENTATION_SUMMARY.md`
- **Admin Setup**: See `ADMIN_SETUP_QUICK_START.md`

---

**Need Help?** Check browser console, API responses, and database records for debugging.
