# Enterprise-Grade Licence Enhancements - Implementation Checklist

## Current Implementation Status

### ✅ Already Implemented

1. **Licence Status Panel** - Basic ✅
   - Status badge (Active/Expired/Pending Renewal)
   - Expiry date
   - Days remaining (with color coding <30 days)
   - Subscriber ID
   - Renewal code display

2. **Device Registration** ✅
   - Register device
   - De-register device
   - Device info display

3. **IP Management** ✅
   - View current/allowed IP
   - Set IP (with cooldown)
   - IP change requests (basic - auto-approves for owner)

4. **Renewal Flow** ✅
   - Renewal code generation
   - Renewal code display when expired

5. **Audit Logs** ✅
   - Basic audit log display

6. **Device Fingerprint** ✅
   - Automatic generation and validation

---

## ❌ Missing Enterprise Features

### 1. Licence Health & Status Panel (HIGH PRIORITY)

**Missing:**
- [ ] "Expiring Soon" status (<30 days remaining)
- [ ] Last Successful Validation Time
- [ ] Licence Type display (1 PC / 1 IP / Annual)
- [ ] Warning banner when <30 days remaining

**Implementation:**
- Add `lastValidatedAt` field to License model
- Update status calculation to include "expiring_soon"
- Display warning banner with renewal CTA when <30 days

---

### 2. Grace Period & Soft Lock (VERY IMPORTANT)

**Missing:**
- [ ] Configurable grace period (7-14 days after expiry)
- [ ] During grace: Allow login, disable POS/exports, show renewal banner
- [ ] After grace: Lock app, allow read-only access only

**Implementation:**
- Add `gracePeriodDays` field to License model
- Add `graceUntil` calculated field
- Update validation to check grace period
- Implement read-only mode middleware

---

### 3. IP Change Request Workflow (ENHANCEMENT)

**Partially Implemented:**
- ✅ IP change requests exist
- ❌ Missing reason field
- ❌ Missing approval/rejection UI
- ❌ Auto-approves for owner (should require admin)

**Implementation:**
- Add `reason` field to `IpChangeRequest` model
- Update UI to show request status (Pending/Approved/Rejected)
- Create admin approval UI
- Remove auto-approval, require admin action

---

### 4. Device Fingerprint Transparency (TRUST FEATURE)

**Missing:**
- [ ] Show OS (Windows/macOS/Linux) in UI
- [ ] Show Browser in UI
- [ ] Show registration timestamp
- [ ] "Request Device Replacement" button with reason

**Implementation:**
- Parse User-Agent to extract OS/Browser
- Store OS/Browser in device registration
- Add device replacement request workflow
- Display device details transparently

---

### 5. Renewal Request + Admin Notes (AUDIT TRAIL)

**Missing:**
- [ ] "Request Renewal" button
- [ ] Admin can add internal notes
- [ ] Payment reference ID field
- [ ] Approval timestamp display

**Implementation:**
- Add `adminNotes` field to License model
- Add `paymentReferenceId` field
- Add `renewalRequestedAt` field
- Create renewal request UI
- Create admin notes UI

---

### 6. Licence Violation Alerts (SECURITY)

**Missing:**
- [ ] Alerts when login from unregistered device
- [ ] Alerts when IP mismatch
- [ ] Show last 5 violations with timestamp and reason
- [ ] Violation reason display

**Implementation:**
- Enhance audit logs to track violations specifically
- Add violation tracking endpoint
- Display violation alerts in UI
- Show last 5 violations with details

---

### 7. Emergency Read-Only Mode (CRITICAL)

**Missing:**
- [ ] If licence invalid: Allow read-only access
- [ ] Disable POS billing
- [ ] Disable data export
- [ ] Allow inventory viewing
- [ ] Allow past invoices viewing

**Implementation:**
- Create `checkLicenceAccess()` middleware
- Implement read-only mode state
- Block write operations (POST/PUT/DELETE)
- Allow read operations (GET)
- Disable specific features (POS, exports)

---

### 8. Licence Export for Audit (PDF/CSV)

**Missing:**
- [ ] "Download Licence Summary (PDF)" button
- [ ] PDF includes: Subscriber name, Licence ID, Device + IP, Validity period, Audit log summary
- [ ] CSV export option
- [ ] Professional formatting

**Implementation:**
- Install PDF generation library (e.g., `pdfkit` or `jspdf`)
- Create export API endpoint
- Generate PDF with licence details
- Generate CSV export option
- Add export button to UI

---

### 9. Security Hardening (OPTIONAL)

**Missing:**
- [ ] Optional 2FA toggle (OTP/email)
- [ ] Rate-limit licence validation failures
- [ ] Device fingerprints already hashed ✅ (already done)

**Implementation:**
- Add 2FA toggle to security settings
- Implement rate limiting middleware
- Add validation attempt tracking

---

## Implementation Priority

### Phase 1: Critical (Immediate)
1. **Grace Period & Soft Lock** - Prevents business disruption
2. **Emergency Read-Only Mode** - Prevents data hostage
3. **Licence Violation Alerts** - Early detection of misuse

### Phase 2: High Priority (Soon)
4. **Licence Health Panel Enhancements** - Better UX
5. **IP Change Request Workflow** - Proper approval flow
6. **Device Fingerprint Transparency** - Builds trust

### Phase 3: Nice to Have (Later)
7. **Renewal Request + Admin Notes** - Better audit trail
8. **Licence Export (PDF/CSV)** - Professional touch
9. **Security Hardening** - Additional security

---

## Quick Wins (Easy to Implement)

1. **Warning Banner** (<30 days) - Just UI change
2. **Last Validation Time** - Add field, update on validation
3. **Licence Type Display** - Just display "1 PC / 1 IP / Annual"
4. **Device OS/Browser** - Parse User-Agent, display in UI
5. **Violation Alerts** - Enhance existing audit logs

---

## Database Schema Changes Needed

### License Model Additions:
```prisma
model License {
  // ... existing fields ...
  
  // New fields for enhancements
  gracePeriodDays     Int?      @default(7) @map("grace_period_days")
  lastValidatedAt     DateTime? @map("last_validated_at")
  adminNotes          String?   @map("admin_notes")
  paymentReferenceId  String?   @map("payment_reference_id")
  renewalRequestedAt  DateTime? @map("renewal_requested_at")
}
```

### IpChangeRequest Model Additions:
```prisma
model IpChangeRequest {
  // ... existing fields ...
  
  // New field
  reason String? // Reason for IP change request
}
```

### DeviceRegistration Model Additions:
```prisma
model DeviceRegistration {
  // ... existing fields ...
  
  // New fields
  operatingSystem String? @map("operating_system")
  browser         String? @map("browser")
}
```

---

## API Endpoints Needed

1. `GET /api/licensing/violations` - Get last 5 violations
2. `POST /api/licensing/renewal-request` - Request renewal
3. `PUT /api/licensing/admin-notes` - Update admin notes (admin only)
4. `GET /api/licensing/export/pdf` - Export licence as PDF
5. `GET /api/licensing/export/csv` - Export licence as CSV
6. `POST /api/licensing/device-replacement-request` - Request device replacement
7. `PUT /api/admin/licences/:id/approve-ip-change` - Approve IP change (admin)
8. `PUT /api/admin/licences/:id/reject-ip-change` - Reject IP change (admin)

---

## UI Components to Add

1. **Warning Banner Component** - Shows when <30 days remaining
2. **Violation Alert Panel** - Shows last 5 violations
3. **Grace Period Banner** - Shows during grace period
4. **Read-Only Mode Banner** - Shows when in read-only mode
5. **Device Details Panel** - Shows OS, Browser, Registration time
6. **IP Change Request Status** - Shows pending/approved/rejected status
7. **Renewal Request Form** - Form to request renewal
8. **Export Buttons** - PDF and CSV export buttons

---

## Middleware Needed

1. **Grace Period Check** - Check if in grace period
2. **Read-Only Mode Check** - Block write operations when expired
3. **Rate Limiting** - Limit validation failures
4. **Validation Tracking** - Track last validation time

---

## Next Steps

1. Review this checklist
2. Prioritize features based on business needs
3. Implement Phase 1 (Critical) features first
4. Test thoroughly
5. Deploy incrementally

---

## Notes

- Device fingerprints are already hashed ✅ (good security practice)
- Audit logs exist ✅ (good foundation)
- IP change requests exist but need approval workflow
- Renewal codes exist but need request workflow

Most features can be added incrementally without breaking existing functionality.
