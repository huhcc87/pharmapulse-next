# Enterprise Licensing Enforcement - 1 PC + 1 IP Policy

## Overview

This system enforces strict licensing at the tenant level:
- **1 PC**: Only one registered device can access the system at a time
- **1 IP**: Only one allowed IP address (configurable, with guardrails)
- **Server-side enforcement**: All checks happen server-side, auditable, and revocable
- **Owner-controlled**: Self-service flows with MFA/cooldown guardrails

## Architecture

### Database Schema

- `licenses`: One license per tenant (status, allowed IP, max devices)
- `device_registrations`: Registered devices (one active per tenant)
- `ip_change_requests`: IP change requests with approval workflow
- `license_audit_logs`: Tamper-evident audit trail

### Enforcement Flow

1. **License Check**: Verify license exists and is active
2. **IP Check**: If `allowed_ip` is set, verify request IP matches
3. **Device Check**: Verify device ID matches registered device (1 PC)

All checks are server-side and logged to audit trail.

## Setup

### 1. Run Migration

```bash
# Apply the licensing schema migration
psql $DATABASE_URL -f prisma/migrations/add_licensing_enforcement.sql

# Or use Prisma migrate (if you prefer)
npx prisma migrate dev --name add_licensing_enforcement
```

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. Create Default Licenses

The migration automatically creates licenses for existing tenants. For new tenants, create a license when the tenant is created:

```typescript
await prisma.license.create({
  data: {
    tenantId: newTenant.id,
    plan: "professional",
    status: "active",
    maxDevices: 1,
    ipPolicy: "single",
  },
});
```

## Usage

### In API Routes

Add licensing enforcement to protected routes:

```typescript
import { checkLicenseEnforcement } from "@/lib/licensing/enforcement";

export async function GET(request: NextRequest) {
  const enforcement = await checkLicenseEnforcement(request);
  
  if (!enforcement.allowed) {
    return NextResponse.json(
      { error: enforcement.error?.code, message: enforcement.error?.message },
      { status: 403 }
    );
  }

  // Your route logic here
}
```

### Device ID Generation

Device IDs are automatically generated and stored in httpOnly cookies. The system:
- Generates UUID on first visit
- Stores in `pp_device_id` cookie (httpOnly, secure)
- Falls back to localStorage if needed (client-side)

### IP Extraction

IP addresses are extracted from request headers, handling:
- Direct connections
- Reverse proxies (X-Forwarded-For)
- Load balancers
- Cloud providers (Vercel, AWS, Cloudflare)

## Owner UI

### Settings → Security & Licensing

**Device Management:**
- View current registered device
- Revoke and register new device (Owner only)
- See device status (current vs. registered)

**IP Management:**
- View current allowed IP
- Set IP to current IP
- Set custom IP
- Cooldown: 24 hours between changes

**Audit Logs:**
- View all license enforcement actions
- Filter by action type
- Export for compliance

## API Endpoints

### Device Management

- `GET /api/licensing/device` - Get device status
- `POST /api/licensing/device` - Register/revoke device
  ```json
  { "action": "revoke" }
  ```

### IP Management

- `GET /api/licensing/ip` - Get IP status
- `POST /api/licensing/ip` - Set or request IP change
  ```json
  { "action": "set", "ip": "192.168.1.1" }
  ```

### Audit Logs

- `GET /api/licensing/audit` - Get audit logs
  - Query params: `limit`, `offset`, `action`

## Error Codes

| Code | Description | User Action |
|------|-------------|-------------|
| `LICENSE_NOT_FOUND` | No license for tenant | Contact support |
| `LICENSE_INACTIVE` | License is suspended/expired | Renew subscription |
| `IP_NOT_ALLOWED` | Request IP doesn't match | Update allowed IP in Settings |
| `DEVICE_MISMATCH` | Device ID doesn't match | Owner must switch device |
| `OWNER_REQUIRED_FOR_FIRST_DEVICE_REG` | No device registered | Owner must register first device |
| `IP_NOT_DETECTED` | Could not determine IP | Contact support |

## Security Features

### Server-Side Enforcement
- All checks happen server-side
- Client UI is not trusted
- Device ID stored in httpOnly cookie

### Audit Trail
- All enforcement actions logged
- Includes IP, device ID, user, route
- Tamper-evident (server-side only)

### Guardrails
- IP change cooldown: 24 hours
- Only Owner can manage devices/IP
- MFA/re-auth required for sensitive changes (can be added)

### No Backdoors
- No hidden admin overrides
- Support access must be consent-based
- All actions logged

## Troubleshooting

### "Device Mismatch" Error

**Problem**: License is locked to another device.

**Solution**: 
1. Owner goes to Settings → Security & Licensing
2. Click "Revoke & Register This Device"
3. This will register the current device

### "IP Not Allowed" Error

**Problem**: Request IP doesn't match allowed IP.

**Solution**:
1. Owner goes to Settings → Security & Licensing
2. Click "Set to My Current IP"
3. Wait for cooldown if recently changed (24 hours)

### "Owner Required" Error

**Problem**: No device registered, and non-owner trying to access.

**Solution**:
1. Owner must log in first
2. System will auto-register first device
3. Then other users can access

### IP Detection Issues

**Problem**: IP not detected correctly (shows as null).

**Possible Causes**:
- Behind complex proxy chain
- Development environment (localhost)
- Cloud provider not setting headers

**Solution**:
- Check `X-Forwarded-For` header in request
- Verify proxy configuration
- For development, IP check is skipped if IP is null (but logged)

## Testing

### Unit Tests

Test enforcement logic:
```typescript
// Test license check
// Test IP matching
// Test device registration
// Test cooldown enforcement
```

### Integration Tests

Test full flow:
1. Owner registers first device
2. Non-owner blocked until device registered
3. IP mismatch blocks access
4. Device mismatch blocks access
5. Owner can switch device
6. IP change cooldown works

## Future Enhancements

- [ ] MFA integration for IP/device changes
- [ ] Email OTP for IP change approval
- [ ] CIDR support (multiple IPs)
- [ ] Recovery codes for lockout
- [ ] Support access tokens (time-bound, consent-based)
- [ ] Device fingerprinting (additional security layer)
- [ ] WebAuthn/Passkeys integration

## Compliance

- All enforcement actions are logged
- Audit trail is tamper-evident
- No hidden overrides
- Owner-controlled self-service
- Time-bound support access (if implemented)

## Support

For issues or questions:
1. Check audit logs in Settings → Security & Licensing
2. Review error codes and messages
3. Contact support with tenant ID and error details
