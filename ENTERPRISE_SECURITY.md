# Enterprise Security Model

## Overview

PharmaPulse implements enterprise-grade security with:
- **RBAC**: Role-based access control with granular permissions
- **Step-up Authentication**: Additional verification for risky actions
- **Maker-Checker**: 4-eyes approval for sensitive operations
- **Tamper-evident Audit Logs**: Hash-chained audit trail
- **Export Controls**: Watermarked exports with rate limiting
- **API Hardening**: CORS, CSP, rate limiting, build tokens
- **Support Mode**: Consent-based, time-bound support access

## 1. RBAC & Permissions

### Roles

- **OWNER**: Full system access, can manage all settings
- **ADMIN**: Can manage users and most settings (except license)
- **PHARMACIST**: Can verify prescriptions and manage inventory
- **CASHIER**: Can process sales and returns
- **INVENTORY**: Can manage stock and inventory
- **AUDITOR**: Read-only access to audit logs and reports

### Permissions

- `REFUND_CREATE`: Create refund transactions
- `DISCOUNT_OVERRIDE`: Apply discounts above threshold
- `PRICE_EDIT`: Modify product prices
- `STOCK_ADJUST`: Adjust inventory quantities
- `GST_EDIT`: Modify GST settings and rates
- `EXPORT_DATA`: Export invoices, reports, and data
- `USER_MANAGE`: Create and manage user accounts
- `LICENSE_MANAGE`: Manage licensing settings
- `APPROVE_ACTIONS`: Approve pending actions (maker-checker)
- `VIEW_AUDIT`: View security audit logs
- `SUPPORT_ACCESS`: Enable support mode

### Usage in API Routes

```typescript
import { requirePermission, getAuthenticatedUserWithPermissions } from "@/lib/security/rbac";

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUserWithPermissions();
  
  // Check permission
  await requirePermission(user.userId, user.tenantId, "REFUND_CREATE");
  
  // Your route logic
}
```

## 2. Step-up Authentication

Required for risky actions:
- IP/device changes
- Data exports
- Refunds above threshold
- Discounts above threshold

### Implementation

Step-up sessions expire after 10 minutes (configurable). Methods:
- **PASSWORD**: Re-authenticate with password
- **TOTP**: Time-based one-time password (MFA)
- **MAGIC_LINK**: Email-based verification

### Usage

```typescript
import { requireStepUpAuth } from "@/lib/security/step-up-auth";

// Before risky action
await requireStepUpAuth(tenantId, userId);
```

## 3. Maker-Checker Approvals

4-eyes principle for actions above thresholds:
- Refunds above ₹1000 (configurable)
- Discounts above 10% (configurable)
- Other sensitive operations

### Flow

1. Maker creates pending action → `status=PENDING`
2. Approver (OWNER/ADMIN with `APPROVE_ACTIONS`) approves
3. System executes action → `status=APPROVED`
4. All steps logged to audit

### Usage

```typescript
import { createPendingAction, approvePendingAction } from "@/lib/security/maker-checker";

// Create pending action
const actionId = await createPendingAction(
  tenantId,
  "REFUND",
  { invoiceId: 123, amount: 1500 },
  userId
);

// Approve (by approver)
await approvePendingAction(tenantId, actionId, approverUserId);
```

## 4. Tamper-evident Audit Logs

### Hash Chaining

Each log entry includes:
- `prev_hash`: Hash of previous entry
- `hash`: SHA-256(prev_hash + tenant_id + actor + action + meta + created_at)

This creates an unbreakable chain - any tampering is detectable.

### Integrity Verification

```typescript
import { verifyAuditLogIntegrity } from "@/lib/security/audit";

const integrity = await verifyAuditLogIntegrity(tenantId);
if (!integrity.valid) {
  // Tampering detected!
  console.error("Invalid entries:", integrity.invalidEntries);
}
```

### Append-only Enforcement

- Database: No UPDATE/DELETE on `security_audit_logs` table
- Application: All writes go through `logSecurityAudit()` function
- Verification: Regular integrity checks recommended

## 5. Export Controls

### Watermarking

All exports include metadata:
- `tenant_id`
- `user_id`
- `timestamp`
- `export_type`
- `export_id` (unique)

### Rate Limiting

- Default: 10 exports per hour per user (configurable)
- Enforced server-side
- Returns 429 if exceeded

### Usage

```typescript
import { createExportRecord, addWatermarkToContent } from "@/lib/security/exports";

// Create export record (requires EXPORT_DATA + step-up auth)
const { exportId, watermark } = await createExportRecord(
  tenantId,
  userId,
  "INVOICE",
  request
);

// Add watermark to content
const watermarkedContent = addWatermarkToContent(
  originalContent,
  watermark,
  "pdf"
);
```

## 6. API Hardening

### CORS

- Strict allowlist from `ALLOWED_ORIGINS` env var
- Default: localhost only (development)
- Production: Add your domains

### CSP (Content Security Policy)

- Restricts resource loading
- Prevents XSS attacks
- Configured for Next.js requirements

### Rate Limiting

- Auth endpoints: 5 requests per 15 minutes
- Licensing endpoints: 10 requests per minute
- Security endpoints: 20 requests per minute
- Default: 100 requests per minute

### Build Tokens

- Frontend includes `X-Build-Token` header
- Server validates against `BUILD_TOKEN` env var
- Prevents unauthorized clients

## 7. Support Mode

### Features

- **Consent-based**: Owner must explicitly enable
- **Time-bound**: Default 30 minutes (configurable)
- **Read-only**: Support can only view diagnostics
- **Maker-checker**: Write actions require owner approval

### Usage

```typescript
import { enableSupportMode, isSupportModeActive } from "@/lib/security/support-mode";

// Owner enables
const { sessionId, expiresAt } = await enableSupportMode(
  tenantId,
  ownerUserId,
  "READ_ONLY",
  30 // minutes
);

// Check if active
const status = await isSupportModeActive(tenantId);
```

## Setup

### 1. Run Migration

```bash
psql $DATABASE_URL -f prisma/migrations/add_enterprise_security.sql
npx prisma generate
```

### 2. Configure Environment

```env
# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Build Token (optional, for production)
BUILD_TOKEN=your-secret-build-token
```

### 3. Assign Roles to Users

Use the Settings UI or API:
```typescript
await assignRoleToUser(tenantId, userId, "PHARMACIST", assignedByUserId);
```

## Settings UI

Go to **Settings → Security** to manage:
- View your roles and permissions
- Configure security thresholds
- Approve pending actions
- Enable/revoke support mode
- View audit logs
- Export audit logs (requires step-up auth)

## API Endpoints

- `GET /api/security/rbac` - Get user roles/permissions
- `POST /api/security/rbac` - Assign role
- `DELETE /api/security/rbac` - Remove role
- `POST /api/security/step-up/verify` - Verify step-up auth
- `GET /api/security/audit` - Get audit logs
- `GET /api/security/audit?export=json` - Export audit logs
- `GET /api/security/pending-actions` - Get pending actions
- `POST /api/security/pending-actions` - Approve action
- `GET /api/security/support/status` - Get support status
- `POST /api/security/support` - Enable support mode
- `GET /api/security/config` - Get security config
- `PUT /api/security/config` - Update security config

## Security Best Practices

1. **Always check permissions server-side** - Never trust client
2. **Use step-up auth for risky actions** - IP changes, exports, large refunds
3. **Require approvals for thresholds** - Configure appropriate thresholds
4. **Regular audit log verification** - Check integrity periodically
5. **Monitor export records** - Track data exports
6. **Limit support sessions** - Use time-bound access only
7. **Keep build tokens secret** - Never expose in client code
8. **Configure CORS strictly** - Only allow trusted domains

## Troubleshooting

### "PERMISSION_REQUIRED" Error

**Problem**: User doesn't have required permission.

**Solution**: Assign appropriate role with permission, or grant permission directly.

### "STEP_UP_REQUIRED" Error

**Problem**: Action requires step-up authentication.

**Solution**: User must verify identity (password/TOTP) before action.

### "PENDING_ACTION_EXPIRED" Error

**Problem**: Pending action expired before approval.

**Solution**: Create new pending action or extend expiration.

### Audit Log Integrity Failure

**Problem**: Hash chain broken, tampering detected.

**Solution**: 
1. Investigate invalid entries
2. Restore from backup if needed
3. Review access logs
4. Report security incident

## Testing

See `ENTERPRISE_SECURITY_TESTS.md` for test suite covering:
- Permission enforcement
- Step-up auth flows
- Maker-checker workflows
- Audit hash chaining
- Export watermarking
- Support mode restrictions

## Compliance

- **Audit Trail**: Complete, tamper-evident
- **Access Control**: Role-based, permission-based
- **Data Protection**: Watermarked exports, rate limited
- **Support Access**: Consent-based, time-bound, logged
- **No Backdoors**: All access is auditable and revocable
