# Licence Registration & Device Setup Guide

This guide explains how to register a device and manage licensing codes for the 1-PC/1-IP licensing system.

## For End Users: Registering Your Device

### Step 1: Access Security & Licensing Page

1. Log in to your PharmaPulse account
2. Navigate to **Settings** → **Security & Licensing** tab

### Step 2: Register Your Device

1. On the Security & Licensing page, find the **"Registered Device (1 PC)"** section
2. If no device is registered, you'll see a "Register This Device" button
3. Click **"Register This Device"**
4. The system will:
   - Capture your device fingerprint (based on browser/device info)
   - Capture your current IP address
   - Save both to your licence
5. You'll see a success message: "Device registered successfully!"
6. The page will refresh to show your registered device information

### What Happens During Registration

- **Device Fingerprint**: Automatically generated from:
  - User-Agent string
  - Platform information
  - Screen resolution (if available)
  - Timezone and language settings
- **IP Address**: Captured from your current network connection

### Important Notes

- **Only ONE device can be registered** at a time (1-PC policy)
- **Only ONE IP address** can be registered at a time (1-IP policy)
- Registration is only available when your licence status is **"Active"**
- If your licence is expired or pending renewal, you must renew first

---

## For Administrators: Managing Licences

### Creating a Licence for a User/Tenant

Licences are automatically created when a user first accesses the Security & Licensing page. However, you can also create or update licences programmatically.

#### Option 1: Automatic Creation (Default)

When a user first visits `/api/licensing/licence`, if no licence exists, one is automatically created with:
- Auto-generated licence key
- 1-year expiry from creation date
- Status: "active"
- Max devices: 1

#### Option 2: Manual Creation via Database/Admin Panel

```typescript
// Example: Create licence manually
const licence = await prisma.license.create({
  data: {
    tenantId: "tenant-id-here",
    subscriberId: "user-id-here", // or tenantId
    licenceKey: generateLicenceKey(), // From licence-utils
    status: "active",
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    maxDevices: 1,
    ipPolicy: "single",
  },
});
```

#### Option 3: Create via API (requires admin endpoint)

You can create an admin API endpoint:

```typescript
// POST /api/admin/licences/create
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  requireAuth(user);
  
  // Only admin/owner
  if (user.role !== "owner" && user.role !== "super_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  
  const { tenantId, subscriberId, durationYears = 1 } = await request.json();
  
  const licenceKey = generateLicenceKey();
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + durationYears);
  
  const licence = await prisma.license.create({
    data: {
      tenantId,
      subscriberId: subscriberId || tenantId,
      licenceKey,
      status: "active",
      expiresAt,
      maxDevices: 1,
      ipPolicy: "single",
    },
  });
  
  return NextResponse.json({
    licence: {
      licence_id: licence.id,
      licence_key: licence.licenceKey,
      expires_at: licence.expiresAt,
    },
  });
}
```

### Providing Licensing Code to Users

The **Licence Key** is the licensing code that identifies a user's licence. Here's how to provide it:

#### Step 1: Get the Licence Key

**For Admins:**
1. Access the database or admin panel
2. Find the user's licence record (by `tenantId` or `subscriberId`)
3. Copy the `licenceKey` field

**Via API (as admin):**
```bash
# Get licence details (as owner/admin)
GET /api/licensing/licence
Authorization: Bearer <admin-token>
```

**Via Database:**
```sql
SELECT id, licence_key, tenant_id, subscriber_id, status, expires_at 
FROM licenses 
WHERE tenant_id = 'your-tenant-id';
```

#### Step 2: Share the Licence Key with User

The licence key format is: `LIC-{random-hex}-{timestamp-hex}`

**Important Security Notes:**
- The licence key is shown **masked** to users (only last 4 characters visible)
- Full licence key is needed for admin operations
- Share the full key securely (encrypted email, secure portal, etc.)

#### Step 3: User Views Their Licence Key

Users can see their **masked** licence key on the Security & Licensing page:
- Format: `••••ABCD` (last 4 characters visible)
- Can click "Copy" to copy the full key (if they have permission)

---

## Renewal Process

### When Licence Expires

1. **Automatic Expiry Check** (daily cron job):
   - Calls `POST /api/licensing/expiry-check`
   - Sets status to "expired"
   - Generates renewal code

2. **User Sees Renewal Code**:
   - Status changes to "Expired" or "Pending Renewal"
   - Renewal code displayed on Security & Licensing page
   - Instructions shown to contact admin

### Renewal Code Format

`RENEW-{HMAC-hash}-{timestamp-hex}`

Example: `RENEW-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6-1a2b3c4d`

### Admin Approves Renewal

**Via API:**
```bash
POST /api/licensing/renew
Content-Type: application/json
Authorization: Bearer <admin-token>

{
  "renewal_code": "RENEW-abc123...",
  "licence_id": "optional-licence-id"
}
```

**What Happens:**
1. Verifies renewal code
2. Generates new licence key
3. Sets expiry to 1 year from now
4. Resets device fingerprint and IP (user must re-register)
5. Sets status to "active"
6. Clears renewal code

**Via Database (manual):**
```typescript
const updatedLicence = await prisma.license.update({
  where: { id: licenceId },
  data: {
    licenceKey: generateLicenceKey(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    registeredDeviceFingerprint: null,
    registeredIp: null,
    allowedIp: null,
    status: "active",
    renewalCode: null,
  },
});
```

---

## Troubleshooting

### "Device mismatch" Error

**Problem**: User tries to login from a different device than registered.

**Solution**:
1. User must de-register current device (if they have access)
2. Or admin must reset the device registration:
   ```typescript
   await prisma.license.update({
     where: { tenantId: "tenant-id" },
     data: {
       registeredDeviceFingerprint: null,
       registeredIp: null,
     },
   });
   ```
3. User registers new device

### "IP address mismatch" Error

**Problem**: User's IP address changed.

**Solution**:
1. User can update IP in Settings → Security & Licensing → "Set to My Current IP"
2. Or admin can update manually:
   ```typescript
   await prisma.license.update({
     where: { tenantId: "tenant-id" },
     data: {
       registeredIp: "new-ip-address",
       allowedIp: "new-ip-address",
     },
   });
   ```

### "Licence expired" Error

**Problem**: Licence has expired.

**Solution**:
1. User contacts admin with renewal code (shown on Security & Licensing page)
2. Admin approves renewal via `/api/licensing/renew`
3. User re-registers device after renewal

### "Cannot register device. Licence status: expired"

**Problem**: Trying to register device when licence is expired.

**Solution**:
1. Renew the licence first
2. Then register the device

---

## Testing the System

### Test Device Registration

```bash
# 1. Get licence (auto-creates if doesn't exist)
curl http://localhost:3000/api/licensing/licence \
  -H "Cookie: pp_user=1; pp_tenant=tenant-1"

# 2. Register device
curl -X POST http://localhost:3000/api/licensing/licence \
  -H "Content-Type: application/json" \
  -H "Cookie: pp_user=1; pp_tenant=tenant-1" \
  -d '{"action": "register_device"}'
```

### Test Login Validation

```bash
# Login (will validate licence automatically)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Test Renewal

```bash
# 1. Manually expire a licence (for testing)
# Update expiresAt to past date in database

# 2. Run expiry check
curl -X POST http://localhost:3000/api/licensing/expiry-check \
  -H "Authorization: Bearer your-expiry-check-secret"

# 3. Approve renewal
curl -X POST http://localhost:3000/api/licensing/renew \
  -H "Content-Type: application/json" \
  -H "Cookie: pp_user=1; pp_tenant=tenant-1" \
  -d '{
    "renewal_code": "RENEW-abc123...",
    "licence_id": "licence-id-here"
  }'
```

---

## Quick Reference

### Licence Key Format
```
LIC-{32-char-hex}-{8-char-hex}
Example: LIC-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6-1a2b3c4d
```

### Renewal Code Format
```
RENEW-{32-char-HMAC}-{timestamp-hex}
Example: RENEW-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6-1a2b3c4d
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/licensing/licence` | GET | Get current user's licence |
| `/api/licensing/licence` | POST | Register/deregister device |
| `/api/licensing/renew` | POST | Approve renewal (admin only) |
| `/api/licensing/expiry-check` | POST | Daily expiry check (cron job) |
| `/api/licensing/audit` | GET | View audit logs |

### Licence Statuses

- **active**: Licence is valid and can be used
- **expired**: Licence has expired, renewal required
- **pending_renewal**: Device deregistered, awaiting admin approval
- **suspended**: Licence is suspended (manual action)

---

## Security Best Practices

1. **Never expose full licence keys** in logs or error messages
2. **Share renewal codes securely** (encrypted channels)
3. **Set up daily expiry check** via cron job
4. **Monitor audit logs** for suspicious activity
5. **Use HTTPS** for all API communications
6. **Rotate secrets** periodically (LICENCE_KEY_SECRET, RENEWAL_CODE_SECRET)
