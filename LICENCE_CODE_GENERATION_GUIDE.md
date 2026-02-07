# Licence Code Generation & Subscription Guide

This guide explains how licence codes are generated, how they vary between subscriptions, and how resubscription works with new codes.

---

## Overview: How Codes Work

### What is a Licence Code?

A **Licence Code** (also called `licence_key`) is a unique identifier for each subscription. It's automatically generated and serves as:
- Unique identifier for the subscription
- Validation token for licence checks
- Reference for admin operations

### Format

```
LIC-{32-character-hex}-{8-character-timestamp-hex}

Example: LIC-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6-1a2b3c4d
```

---

## How Codes Are Generated

### Automatic Generation (Default)

**Codes are automatically generated** when:
1. A new licence is created
2. A licence is renewed
3. Admin creates a new subscription

### Generation Method

```typescript
// Located in: src/lib/licensing/licence-utils.ts

export function generateLicenceKey(): string {
  const randomBytes = crypto.randomBytes(16).toString('hex'); // 32 hex chars
  const timestamp = Date.now().toString(16).padStart(8, '0'); // 8 hex chars
  return `LIC-${randomBytes}-${timestamp}`;
}
```

**How it works:**
1. Generates 16 random bytes → converts to 32-character hex string
2. Gets current timestamp → converts to 8-character hex string
3. Combines: `LIC-{random}-{timestamp}`

**Result:** Every code is unique and cryptographically secure!

---

## How Codes Vary Between Subscriptions

### 1. New Subscription → New Code

When a customer subscribes for the first time:

```javascript
// Automatically happens when creating licence
const licence = await prisma.license.create({
  data: {
    tenantId: "customer-123",
    licenceKey: generateLicenceKey(), // NEW CODE GENERATED
    status: "active",
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  },
});

// Result: licenceKey = "LIC-abc123...-1a2b3c4d"
```

**Each customer gets a UNIQUE code** - no two subscriptions share the same code.

### 2. Renewal → New Code (Different from Original)

When a customer renews their subscription:

```javascript
// Old code: LIC-abc123...-1a2b3c4d
// Renewal generates NEW code: LIC-xyz789...-5e6f7g8h

const updatedLicence = await prisma.license.update({
  where: { id: licenceId },
  data: {
    licenceKey: generateLicenceKey(), // NEW CODE GENERATED
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year extension
    status: "active",
    renewalCode: null,
  },
});

// Old code becomes invalid
// New code is active
```

**Key Points:**
- ✅ Old code is **replaced** (not deleted, but inactive)
- ✅ New code is **automatically generated**
- ✅ Customer must use **new code** after renewal
- ✅ Old code cannot be used anymore

### 3. Different Subscription Plans → Same Generation Method

All subscription plans use the **same generation method**, but:
- Each subscription gets a **unique code**
- Codes are tied to specific `tenantId` (customer)
- Codes cannot be transferred between customers

---

## Resubscription Process

### Scenario: Customer Renews After Expiry

#### Step 1: Licence Expires (Automatic)

```javascript
// Daily cron job runs: POST /api/licensing/expiry-check
// Sets status = "expired"
// Generates renewal code: RENEW-{HMAC}-{timestamp}
```

**What happens:**
- Status changes to "expired"
- Renewal code is generated: `RENEW-abc123...-1a2b3c4d`
- Old licence key still exists but is **inactive**
- Customer sees renewal code on Security & Licensing page

#### Step 2: Customer Contacts Admin with Renewal Code

Customer provides:
- Renewal code: `RENEW-abc123...-1a2b3c4d`
- Customer ID / Tenant ID

#### Step 3: Admin Approves Renewal

```bash
# Admin renews via API
curl -X PATCH "http://localhost:3000/api/admin/licences?licenceId=licence-id/renew" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  -d '{
    "durationYears": 1
  }'
```

**What happens automatically:**
1. ✅ **New licence key generated** (different from old one)
2. ✅ Old licence key becomes inactive
3. ✅ Expiry date extended by 1 year (or specified duration)
4. ✅ Status set to "active"
5. ✅ Renewal code cleared (no longer needed)
6. ✅ Device/IP registration reset (customer must re-register)

**Response:**
```json
{
  "success": true,
  "message": "Licence renewed successfully. User must re-register device.",
  "licence": {
    "licence_id": "clx123...",
    "new_licence_key": "LIC-xyz789...-5e6f7g8h", // NEW CODE
    "expires_at": "2026-12-31T00:00:00.000Z",
    "status": "active"
  }
}
```

#### Step 4: Provide New Code to Customer

**Admin provides:**
- New licence key: `LIC-xyz789...-5e6f7g8h`
- Customer uses this for their new subscription

#### Step 5: Customer Re-registers Device

Customer:
1. Logs in with new licence
2. Goes to Settings → Security & Licensing
3. Clicks "Register This Device"
4. System validates new licence key
5. Device/IP registered with new subscription

---

## Automatic Code Generation Flow

### When Codes Are Auto-Generated

#### 1. New Subscription Creation

**Via Admin API:**
```bash
POST /api/admin/licences
{
  "tenantId": "customer-123",
  "durationYears": 1
}
```

**What happens:**
```javascript
// In route handler (automatic)
const licenceKey = generateLicenceKey(); // ← AUTOMATIC

const licence = await prisma.license.create({
  data: {
    tenantId: "customer-123",
    licenceKey, // ← NEW CODE
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    status: "active",
  },
});

// Response includes: licence.licenceKey
```

**Result:** Code is automatically generated and returned to admin.

#### 2. First-Time Access (User Triggers)

**Via User Access:**
```javascript
// User first visits: GET /api/licensing/licence

// If no licence exists, one is automatically created:
if (!licence) {
  const licenceKey = generateLicenceKey(); // ← AUTOMATIC
  licence = await prisma.license.create({
    data: {
      tenantId: user.tenantId,
      licenceKey, // ← NEW CODE
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      status: "active",
    },
  });
}
```

**Result:** Code is automatically generated on first access.

#### 3. Renewal (Admin Action)

**Via Admin API:**
```bash
PATCH /api/admin/licences?licenceId={id}/renew
{
  "durationYears": 1
}
```

**What happens:**
```javascript
// In route handler (automatic)
const newLicenceKey = generateLicenceKey(); // ← AUTOMATIC

await prisma.license.update({
  where: { id: licenceId },
  data: {
    licenceKey: newLicenceKey, // ← NEW CODE (replaces old)
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    status: "active",
    renewalCode: null,
  },
});
```

**Result:** New code automatically generated and old code replaced.

---

## Complete Subscription Lifecycle

### 1. Initial Subscription

```
Customer subscribes
    ↓
Admin creates licence via API
    ↓
System auto-generates: LIC-abc123...-1a2b3c4d
    ↓
Admin provides code to customer
    ↓
Customer registers device with code
    ↓
Active subscription
```

### 2. Renewal Before Expiry

```
Licence still active
    ↓
Admin renews via API
    ↓
System auto-generates NEW code: LIC-xyz789...-5e6f7g8h
    ↓
Old code (LIC-abc123...) becomes inactive
    ↓
Admin provides NEW code to customer
    ↓
Customer re-registers device with NEW code
    ↓
Extended active subscription
```

### 3. Renewal After Expiry

```
Licence expires (status = "expired")
    ↓
System auto-generates renewal code: RENEW-abc123...-1a2b3c4d
    ↓
Customer sees renewal code on Security & Licensing page
    ↓
Customer contacts admin with renewal code
    ↓
Admin approves renewal via API
    ↓
System auto-generates NEW licence key: LIC-xyz789...-5e6f7g8h
    ↓
Old code (LIC-abc123...) becomes inactive
    ↓
Admin provides NEW code to customer
    ↓
Customer re-registers device with NEW code
    ↓
Renewed active subscription
```

---

## Code Uniqueness & Security

### Why Each Code is Unique

1. **Random Component:** 32-character random hex (2^128 possible combinations)
2. **Timestamp Component:** 8-character hex timestamp (ensures uniqueness even if generated at same millisecond)
3. **Cryptographically Secure:** Uses `crypto.randomBytes()` (cryptographically secure PRNG)

### Code Storage

```javascript
// In database (licenses table)
{
  id: "clx123...",
  tenantId: "customer-123",
  licenceKey: "LIC-abc123...-1a2b3c4d", // Stored as-is
  status: "active",
  expiresAt: "2025-12-31T00:00:00.000Z"
}
```

### Code Validation

```javascript
// When user logs in or accesses system
const licence = await prisma.license.findUnique({
  where: { tenantId: user.tenantId },
});

// System validates:
if (licence.licenceKey === providedCode) {
  // Valid code
} else {
  // Invalid code
}
```

---

## API Examples

### Create Subscription (Auto-Generates Code)

```bash
curl -X POST http://localhost:3000/api/admin/licences \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  -d '{
    "tenantId": "customer-123",
    "durationYears": 1
  }'
```

**Response:**
```json
{
  "success": true,
  "licence": {
    "licence_key": "LIC-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6-1a2b3c4d"
  }
}
```

**Provide this code to customer as their licensing code.**

### Renew Subscription (Auto-Generates New Code)

```bash
curl -X PATCH "http://localhost:3000/api/admin/licences?licenceId=licence-id/renew" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  -d '{"durationYears": 1}'
```

**Response:**
```json
{
  "success": true,
  "licence": {
    "new_licence_key": "LIC-x9y8z7w6v5u4t3s2r1q0p9o8n7m6-5e6f7g8h"
  }
}
```

**Provide this NEW code to customer (old code no longer works).**

### List All Codes (Admin View)

```bash
curl -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  "http://localhost:3000/api/admin/licences?status=active"
```

**Response:**
```json
{
  "licences": [
    {
      "licence_id": "clx123...",
      "tenant_id": "customer-123",
      "licence_key": "••••3c4d", // Masked for display
      "licence_key_full": "LIC-abc123...-1a2b3c4d", // Full code for admin
      "status": "active",
      "expires_at": "2025-12-31T00:00:00.000Z"
    }
  ]
}
```

---

## Renewal Code vs Licence Key

### Renewal Code (Temporary)

**Purpose:** For customer to request renewal when licence expires

**Format:** `RENEW-{HMAC}-{timestamp}`

**Generated:** Automatically when licence expires

**Valid for:** 30 days

**Used for:** Customer to contact admin for renewal

### Licence Key (Permanent)

**Purpose:** Unique identifier for active subscription

**Format:** `LIC-{random}-{timestamp}`

**Generated:** Automatically on creation/renewal

**Valid for:** Life of subscription

**Used for:** Subscription validation and device registration

---

## Key Points Summary

1. ✅ **Codes are automatically generated** - No manual entry needed
2. ✅ **Each subscription gets a unique code** - No duplicates
3. ✅ **Renewal generates a NEW code** - Old code becomes inactive
4. ✅ **Codes cannot be reused** - Each renewal = new code
5. ✅ **Codes are cryptographically secure** - Cannot be guessed
6. ✅ **Customer must use new code** - After renewal, old code won't work
7. ✅ **Device must be re-registered** - After renewal with new code

---

## Best Practices

### For Admins

1. **Save codes securely** - Provide to customers via secure channel
2. **Track code changes** - Old codes become inactive after renewal
3. **Notify customers** - Inform them when new code is generated
4. **Use renewal codes** - Customers provide renewal code for resubscription

### For Customers

1. **Keep your code safe** - Don't share with others
2. **Update after renewal** - Use new code provided after renewal
3. **Re-register device** - After renewal with new code
4. **Save renewal code** - If licence expires, use renewal code to request renewal

---

## Troubleshooting

### "Invalid licence code" Error

**Problem:** Customer using old code after renewal

**Solution:**
1. Check if licence was renewed
2. Provide customer with NEW code from renewal
3. Customer must re-register device with new code

### "Code already in use" Error

**Problem:** Trying to reuse an old code

**Solution:**
- Old codes become inactive after renewal
- Customer must use the NEW code provided after renewal

### "Code expired" Error

**Problem:** Licence expired and renewal needed

**Solution:**
1. Check renewal code (shown on Security & Licensing page)
2. Contact admin with renewal code
3. Admin approves renewal → new code generated
4. Customer uses new code

---

## Example Workflow

### Scenario: Annual Renewal

**Year 1:**
```
Admin creates subscription → Code: LIC-abc123...-1a2b3c4d
Customer registers device → Active subscription
```

**Year 2 (Renewal):**
```
Admin renews subscription → NEW Code: LIC-xyz789...-5e6f7g8h
Old code (LIC-abc123...) becomes inactive
Customer re-registers device with NEW code → Active subscription
```

**Year 3 (Renewal):**
```
Admin renews subscription → NEW Code: LIC-mno456...-9i0j1k2l
Old code (LIC-xyz789...) becomes inactive
Customer re-registers device with NEW code → Active subscription
```

**Each renewal = NEW unique code!**

---

## Code Generation Implementation

See `src/lib/licensing/licence-utils.ts` for the actual implementation:

```typescript
export function generateLicenceKey(): string {
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(16).padStart(8, '0');
  return `LIC-${randomBytes}-${timestamp}`;
}
```

**This is automatically called when:**
- Creating new licence
- Renewing licence
- Admin creates subscription

**No manual code entry required!**

---

## Summary

✅ **Automatic Generation:** Codes are automatically generated - you never type them manually

✅ **Unique Per Subscription:** Each subscription gets a unique code

✅ **New Code on Renewal:** Renewal always generates a NEW different code

✅ **Old Code Inactive:** After renewal, old code no longer works

✅ **Customer Must Re-register:** After renewal, customer must register device with new code

✅ **Secure & Random:** Codes are cryptographically secure and cannot be guessed

The system handles all code generation automatically - you just create subscriptions and renewals, and codes are generated for you!
