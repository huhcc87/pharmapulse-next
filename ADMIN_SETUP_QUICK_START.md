# Admin Licence Management - Quick Setup

**⚠️ SECURE ADMIN ENDPOINT - Only you can access this!**

---

## Step 1: Set Your Admin Codes

Add these to your `.env` file (or production environment variables):

```bash
# Admin Master Secret (64+ characters recommended)
ADMIN_MASTER_SECRET=change-this-to-a-random-secret-key-in-production-2024

# Admin Master Code (16+ characters recommended)  
ADMIN_MASTER_CODE=YOUR_SECRET_ADMIN_CODE_HERE
```

### Generate Secure Codes:

```bash
# Generate secure secret (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate secure admin code
node -e "console.log(require('crypto').randomBytes(16).toString('hex').toUpperCase())"
```

**Example:**
```bash
ADMIN_MASTER_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
ADMIN_MASTER_CODE=A1B2C3D4E5F6G7H8
```

---

## Step 2: Access the Admin API

### Option A: Using X-Admin-Code Header (Recommended)

```bash
curl -H "X-Admin-Code: YOUR_SECRET_ADMIN_CODE_HERE" \
  http://localhost:3000/api/admin/licences
```

### Option B: Using Authorization Bearer Token

```bash
curl -H "Authorization: Bearer your-super-secret-key" \
  http://localhost:3000/api/admin/licences
```

### Option C: Include in Request Body (POST/PUT/PATCH)

```bash
curl -X POST http://localhost:3000/api/admin/licences \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-123",
    "adminCode": "YOUR_SECRET_ADMIN_CODE_HERE"
  }'
```

---

## Step 3: Basic Operations

### Create a New Licence

```bash
curl -X POST http://localhost:3000/api/admin/licences \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_SECRET_ADMIN_CODE_HERE" \
  -d '{
    "tenantId": "customer-tenant-id",
    "subscriberId": "customer-user-id",
    "durationYears": 1,
    "status": "active"
  }'
```

**Response includes `licence_key` - this is the licensing code to give to the customer!**

### List All Licences

```bash
curl -H "X-Admin-Code: YOUR_SECRET_ADMIN_CODE_HERE" \
  "http://localhost:3000/api/admin/licences?status=active"
```

### Renew a Licence

```bash
curl -X PATCH "http://localhost:3000/api/admin/licences?licenceId=licence-id-here/renew" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_SECRET_ADMIN_CODE_HERE" \
  -d '{"durationYears": 1}'
```

**Response includes `new_licence_key` - provide this to the customer!**

### Update Licence Status

```bash
curl -X PUT "http://localhost:3000/api/admin/licences?licenceId=licence-id-here" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_SECRET_ADMIN_CODE_HERE" \
  -d '{
    "status": "suspended",
    "registeredDeviceFingerprint": null,
    "registeredIp": null
  }'
```

### Delete Licence

```bash
curl -X DELETE "http://localhost:3000/api/admin/licences?licenceId=licence-id-here" \
  -H "X-Admin-Code: YOUR_SECRET_ADMIN_CODE_HERE" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Customer cancelled"}'
```

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/licences` | List all licences |
| POST | `/api/admin/licences` | Create new licence |
| PUT | `/api/admin/licences?licenceId={id}` | Update licence |
| PATCH | `/api/admin/licences?licenceId={id}/renew` | Renew licence |
| DELETE | `/api/admin/licences?licenceId={id}` | Delete licence |

---

## Complete Workflow

### 1. Create Licence for New Customer

```bash
# Create licence
RESPONSE=$(curl -X POST http://localhost:3000/api/admin/licences \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_SECRET_ADMIN_CODE_HERE" \
  -d '{
    "tenantId": "customer-123",
    "durationYears": 1
  }')

# Extract licensing code
echo $RESPONSE | jq -r '.licence.licence_key'
```

**Provide the `licence_key` to your customer as their "licensing code".**

### 2. Customer Uses the Code

- Customer logs in
- Goes to Settings → Security & Licensing
- Clicks "Register This Device"
- System validates and registers their device/IP

### 3. Renew When Expired

```bash
# Renew licence
RESPONSE=$(curl -X PATCH "http://localhost:3000/api/admin/licences?licenceId=licence-id/renew" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Code: YOUR_SECRET_ADMIN_CODE_HERE" \
  -d '{"durationYears": 1}')

# Get new licensing code
echo $RESPONSE | jq -r '.licence.new_licence_key'
```

**Provide the new `licence_key` to the customer.**

---

## Security Reminders

1. ✅ **Never commit admin codes to Git**
2. ✅ **Use HTTPS in production** (never HTTP)
3. ✅ **Keep codes secret** - only you should know them
4. ✅ **Rotate codes periodically** (every 90 days)
5. ✅ **Use different codes** for dev/staging/prod

---

## Full Documentation

See `ADMIN_LICENCE_API_GUIDE.md` for complete API documentation, error handling, and advanced examples.

---

## Need Help?

- Check `ADMIN_LICENCE_API_GUIDE.md` for detailed documentation
- Check `LICENCE_REGISTRATION_GUIDE.md` for user registration guide
- All admin actions are logged in `license_audit_logs` table
