# Admin Licence Management API Guide

**SECURE ADMIN ENDPOINT - Only accessible with special admin code**

This API provides full control over licence management and can only be accessed with the special admin code/secret that you configure.

---

## Setup

### 1. Set Environment Variables

Add these to your `.env` file:

```bash
# Admin Master Secret (for Bearer token authentication)
ADMIN_MASTER_SECRET=your-super-secret-key-change-this-in-production-2024

# Admin Master Code (for X-Admin-Code header or body)
ADMIN_MASTER_CODE=YOUR_ADMIN_CODE_HERE
```

**⚠️ IMPORTANT:** Change these values immediately in production! Use strong, random values.

### 2. Generate Secure Codes

```bash
# Generate a secure random secret (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate a secure admin code
node -e "console.log(require('crypto').randomBytes(16).toString('hex').toUpperCase())"
```

---

## Authentication Methods

The API accepts admin authentication in **3 ways** (choose one):

### Method 1: X-Admin-Code Header (Recommended)
```bash
curl -H "X-Admin-Code: YOUR_ADMIN_CODE_HERE" \
  https://your-domain.com/api/admin/licences
```

### Method 2: Authorization Bearer Token
```bash
curl -H "Authorization: Bearer your-super-secret-key" \
  https://your-domain.com/api/admin/licences
```

### Method 3: Admin Code in Request Body (for POST/PUT/PATCH)
```json
{
  "tenantId": "tenant-id",
  "adminCode": "YOUR_ADMIN_CODE_HERE"
}
```

---

## API Endpoints

### 1. List All Licences

**GET** `/api/admin/licences`

**Query Parameters:**
- `status` (optional): Filter by status (`active`, `expired`, `suspended`, `pending_renewal`)
- `tenantId` (optional): Filter by tenant ID
- `limit` (optional): Limit results (default: 100)
- `offset` (optional): Offset for pagination

**Example:**
```bash
curl -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  "https://your-domain.com/api/admin/licences?status=active&limit=50"
```

**Response:**
```json
{
  "success": true,
  "licences": [
    {
      "licence_id": "clx123...",
      "tenant_id": "tenant-1",
      "subscriber_id": "user-1",
      "licence_key": "••••3c4d",
      "licence_key_full": "LIC-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6-1a2b3c4d",
      "registered_ip": "192.168.1.100",
      "expires_at": "2025-12-31T00:00:00.000Z",
      "status": "active",
      "renewal_code": null,
      "plan": "professional",
      "max_devices": 1,
      "days_remaining": 350,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### 2. Create New Licence

**POST** `/api/admin/licences`

**Request Body:**
```json
{
  "tenantId": "tenant-id-here",
  "subscriberId": "user-id-here",  // optional
  "durationYears": 1,               // optional, default: 1
  "maxDevices": 1,                  // optional, default: 1
  "plan": "professional",           // optional
  "status": "active",               // optional, default: "active"
  "adminCode": "YOUR_ADMIN_CODE"    // required if not in header
}
```

**Example:**
```bash
curl -X POST https://your-domain.com/api/admin/licences \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  -d '{
    "tenantId": "tenant-123",
    "subscriberId": "user-456",
    "durationYears": 1,
    "maxDevices": 1,
    "status": "active"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Licence created successfully",
  "licence": {
    "licence_id": "clx123...",
    "tenant_id": "tenant-123",
    "subscriber_id": "user-456",
    "licence_key": "LIC-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6-1a2b3c4d",
    "expires_at": "2025-12-31T00:00:00.000Z",
    "status": "active",
    "days_remaining": 365
  }
}
```

---

### 3. Update Licence

**PUT** `/api/admin/licences?licenceId={licence-id}`

**Request Body:**
```json
{
  "status": "active",                    // optional
  "expiresAt": "2025-12-31T00:00:00Z",  // optional (ISO date string)
  "maxDevices": 1,                       // optional
  "renewalCode": null,                   // optional (set to null to clear)
  "registeredDeviceFingerprint": null,   // optional (reset device registration)
  "registeredIp": null,                  // optional (reset IP)
  "adminCode": "YOUR_ADMIN_CODE"         // required if not in header
}
```

**Example:**
```bash
curl -X PUT "https://your-domain.com/api/admin/licences?licenceId=clx123" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  -d '{
    "status": "suspended",
    "registeredDeviceFingerprint": null,
    "registeredIp": null
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Licence updated successfully",
  "licence": {
    "licence_id": "clx123...",
    "tenant_id": "tenant-123",
    "status": "suspended",
    "expires_at": "2025-12-31T00:00:00.000Z",
    "days_remaining": 350
  }
}
```

---

### 4. Renew Licence

**PATCH** `/api/admin/licences?licenceId={licence-id}/renew`

**Request Body:**
```json
{
  "durationYears": 1,              // optional, default: 1
  "adminCode": "YOUR_ADMIN_CODE"   // required if not in header
}
```

**Example:**
```bash
curl -X PATCH "https://your-domain.com/api/admin/licences?licenceId=clx123/renew" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  -d '{
    "durationYears": 1
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Licence renewed successfully. User must re-register device.",
  "licence": {
    "licence_id": "clx123...",
    "tenant_id": "tenant-123",
    "new_licence_key": "LIC-new-key-generated-here",
    "expires_at": "2026-12-31T00:00:00.000Z",
    "status": "active",
    "days_remaining": 365
  }
}
```

**Note:** Renewal automatically:
- Generates a new licence key
- Resets device fingerprint (user must re-register)
- Resets IP address
- Sets status to "active"
- Clears renewal code

---

### 5. Delete/Revoke Licence

**DELETE** `/api/admin/licences?licenceId={licence-id}`

**Request Body (optional):**
```json
{
  "adminCode": "YOUR_ADMIN_CODE",  // required if not in header
  "reason": "Reason for deletion"  // optional
}
```

**Example:**
```bash
curl -X DELETE "https://your-domain.com/api/admin/licences?licenceId=clx123" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  -d '{
    "reason": "Customer cancelled subscription"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Licence deleted successfully",
  "deleted_licence_id": "clx123..."
}
```

---

## Common Use Cases

### 1. Create Licence for New Customer

```bash
curl -X POST https://your-domain.com/api/admin/licences \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  -d '{
    "tenantId": "customer-tenant-id",
    "subscriberId": "customer-user-id",
    "durationYears": 1,
    "status": "active"
  }'
```

**Save the returned `licence_key` - this is the licensing code to provide to the customer.**

### 2. Extend Expiry Date for Existing Customer

```bash
curl -X PUT "https://your-domain.com/api/admin/licences?licenceId=licence-id" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  -d '{
    "expiresAt": "2026-12-31T00:00:00Z"
  }'
```

### 3. Suspend Licence (Temporarily Disable)

```bash
curl -X PUT "https://your-domain.com/api/admin/licences?licenceId=licence-id" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  -d '{
    "status": "suspended"
  }'
```

### 4. Reset Device Registration (Allow User to Re-register)

```bash
curl -X PUT "https://your-domain.com/api/admin/licences?licenceId=licence-id" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  -d '{
    "registeredDeviceFingerprint": null,
    "registeredIp": null
  }'
```

### 5. Renew Licence with New Key

```bash
curl -X PATCH "https://your-domain.com/api/admin/licences?licenceId=licence-id/renew" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  -d '{
    "durationYears": 1
  }'
```

**Save the returned `new_licence_key` and provide it to the customer.**

### 6. Find Licence by Tenant ID

```bash
curl -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  "https://your-domain.com/api/admin/licences?tenantId=tenant-id-here"
```

### 7. List All Expired Licences

```bash
curl -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  "https://your-domain.com/api/admin/licences?status=expired"
```

---

## Security Best Practices

1. **Never commit admin codes to Git**
   - Add `.env` to `.gitignore`
   - Use environment variables only

2. **Use HTTPS in Production**
   - Never send admin codes over HTTP
   - All API calls must use HTTPS

3. **Rotate Admin Codes Periodically**
   - Change `ADMIN_MASTER_SECRET` and `ADMIN_MASTER_CODE` every 90 days
   - Update all scripts/tools using the codes

4. **Limit Access**
   - Only you (admin) should know the codes
   - Don't share codes with other team members
   - Use separate codes for different environments (dev/staging/prod)

5. **Monitor Audit Logs**
   - All admin actions are logged in `license_audit_logs`
   - Check logs regularly for unauthorized access

6. **Rate Limiting** (Recommended)
   - Consider adding rate limiting to prevent brute force
   - Example: Max 10 requests per minute per IP

---

## Error Responses

### Unauthorized (401)
```json
{
  "error": "UNAUTHORIZED",
  "message": "Admin authentication required",
  "hint": "Use X-Admin-Code header or Authorization Bearer token"
}
```

### Not Found (404)
```json
{
  "error": "Licence not found"
}
```

### Validation Error (400)
```json
{
  "error": "Validation error",
  "details": [
    {
      "path": ["tenantId"],
      "message": "Tenant ID is required"
    }
  ]
}
```

---

## Testing

### Test Admin Access
```bash
# Test with admin code header
curl -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  http://localhost:3000/api/admin/licences

# Test with bearer token
curl -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  http://localhost:3000/api/admin/licences
```

### Test Create Licence
```bash
curl -X POST http://localhost:3000/api/admin/licences \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  -d '{
    "tenantId": "test-tenant",
    "durationYears": 1,
    "adminCode": "YOUR_ADMIN_CODE"
  }'
```

---

## Complete Workflow Example

### 1. Create Licence for New Customer

```bash
# Create licence
RESPONSE=$(curl -X POST https://your-domain.com/api/admin/licences \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  -d '{
    "tenantId": "customer-123",
    "subscriberId": "user-456",
    "durationYears": 1
  }')

# Extract licence key
LICENCE_KEY=$(echo $RESPONSE | jq -r '.licence.licence_key')

# Provide LICENCE_KEY to customer as their "licensing code"
echo "Customer's Licensing Code: $LICENCE_KEY"
```

### 2. Customer Registers Device

Customer:
1. Logs in
2. Goes to Settings → Security & Licensing
3. Clicks "Register This Device"
4. Device is registered with their licence

### 3. Renew Licence When Expired

```bash
# Renew licence
curl -X PATCH "https://your-domain.com/api/admin/licences?licenceId=licence-id/renew" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_ADMIN_CODE" \
  -d '{"durationYears": 1}'

# Get new licence key from response and provide to customer
```

---

## Integration Examples

### Node.js/TypeScript
```typescript
const ADMIN_CODE = process.env.ADMIN_MASTER_CODE;

async function createLicence(tenantId: string, durationYears: number = 1) {
  const response = await fetch('https://your-domain.com/api/admin/licences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Code': ADMIN_CODE,
    },
    body: JSON.stringify({
      tenantId,
      durationYears,
      status: 'active',
    }),
  });
  
  const data = await response.json();
  return data.licence.licence_key; // Return licensing code
}
```

### Python
```python
import requests
import os

ADMIN_CODE = os.environ.get('ADMIN_MASTER_CODE')

def create_licence(tenant_id: str, duration_years: int = 1):
    response = requests.post(
        'https://your-domain.com/api/admin/licences',
        headers={
            'Content-Type': 'application/json',
            'X-Admin-Code': ADMIN_CODE,
        },
        json={
            'tenantId': tenant_id,
            'durationYears': duration_years,
            'status': 'active',
        }
    )
    data = response.json()
    return data['licence']['licence_key']  # Return licensing code
```

---

## Notes

- All admin actions are logged in `license_audit_logs` table
- Full licence keys are only shown in admin responses (users see masked keys)
- Renewal automatically resets device/IP registration (user must re-register)
- Deleted licences cascade delete all related audit logs

---

**Remember:** Keep your admin codes secret and never commit them to version control!
