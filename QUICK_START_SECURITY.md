# Quick Start: Enterprise Security

## 1. Run Migration

```bash
cd pharmapulse-next
psql $DATABASE_URL -f prisma/migrations/add_enterprise_security.sql
npx prisma generate
```

## 2. Add Security Guards to API Routes

### Example: Protected Route with Permission Check

```typescript
// src/app/api/invoices/refund/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserWithPermissions } from "@/lib/security/rbac";
import { requireStepUpAuth } from "@/lib/security/step-up-auth";
import { requiresApproval, createPendingAction } from "@/lib/security/maker-checker";
import { logSecurityAudit } from "@/lib/security/audit";

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUserWithPermissions();
  
  // Check permission
  if (!user.permissions.includes("REFUND_CREATE")) {
    return NextResponse.json(
      { error: "REFUND_CREATE permission required" },
      { status: 403 }
    );
  }
  
  const body = await request.json();
  const { invoiceId, amount } = body;
  
  // Check if approval required
  const needsApproval = await requiresApproval(user.tenantId, "REFUND", amount);
  
  if (needsApproval) {
    // Create pending action
    const actionId = await createPendingAction(
      user.tenantId,
      "REFUND",
      { invoiceId, amount },
      user.userId
    );
    
    return NextResponse.json({
      pending: true,
      actionId,
      message: "Refund requires approval",
    });
  }
  
  // Require step-up auth for refunds
  await requireStepUpAuth(user.tenantId, user.userId);
  
  // Process refund
  // ... your refund logic ...
  
  // Log to audit
  await logSecurityAudit(
    user.tenantId,
    user.userId,
    "REFUND_CREATED",
    { invoiceId, amount }
  );
  
  return NextResponse.json({ success: true });
}
```

### Example: Export with Watermarking

```typescript
// src/app/api/invoices/export/route.ts
import { createExportRecord, addWatermarkToContent } from "@/lib/security/exports";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUserWithPermissions();
  
  // Check permission (includes step-up auth check)
  if (!user.permissions.includes("EXPORT_DATA")) {
    return NextResponse.json({ error: "EXPORT_DATA permission required" }, { status: 403 });
  }
  
  // Create export record (handles step-up auth + rate limiting)
  const { exportId, watermark } = await createExportRecord(
    user.tenantId,
    user.userId,
    "INVOICE",
    request
  );
  
  // Generate export content
  const content = generateInvoicePDF(invoiceId);
  
  // Add watermark
  const watermarkedContent = addWatermarkToContent(content, watermark, "pdf");
  
  // Log to audit
  await logSecurityAudit(user.tenantId, user.userId, "EXPORT_CREATED", {
    exportId,
    exportType: "INVOICE",
  });
  
  return new NextResponse(watermarkedContent, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${exportId}.pdf"`,
    },
  });
}
```

## 3. Common Patterns

### Check Permission
```typescript
import { requirePermission } from "@/lib/security/rbac";

await requirePermission(userId, tenantId, "STOCK_ADJUST");
```

### Check Role
```typescript
import { requireRole } from "@/lib/security/rbac";

await requireRole(userId, tenantId, "PHARMACIST");
```

### Require Step-up Auth
```typescript
import { requireStepUpAuth } from "@/lib/security/step-up-auth";

await requireStepUpAuth(tenantId, userId);
```

### Log to Audit
```typescript
import { logSecurityAudit } from "@/lib/security/audit";

await logSecurityAudit(tenantId, userId, "ACTION_NAME", {
  // metadata
});
```

### Check Approval Required
```typescript
import { requiresApproval } from "@/lib/security/maker-checker";

const needsApproval = await requiresApproval(tenantId, "DISCOUNT", discountPercent);
if (needsApproval) {
  // Create pending action
}
```

## 4. Settings UI

Go to **Settings → Security** to:
- View your roles and permissions
- Configure thresholds (refund, discount)
- Approve pending actions
- Enable/revoke support mode
- View audit logs
- Export audit logs

## 5. Environment Variables

```env
# CORS allowed origins (comma-separated)
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Build token (optional, for production)
BUILD_TOKEN=your-secret-token
```

## That's It!

Your enterprise security is now active. All checks are:
- ✅ Server-side
- ✅ Auditable
- ✅ Revocable
- ✅ No backdoors

See `ENTERPRISE_SECURITY.md` for full documentation.
