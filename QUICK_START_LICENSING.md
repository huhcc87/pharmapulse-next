# Quick Start: Licensing Enforcement

## Step 1: Run Migration

```bash
cd pharmapulse-next
psql $DATABASE_URL -f prisma/migrations/add_licensing_enforcement.sql
npx prisma generate
```

## Step 2: Add to Protected Routes

Add licensing check to any protected API route:

```typescript
// src/app/api/your-route/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkLicenseEnforcement } from "@/lib/licensing/enforcement";

export async function GET(request: NextRequest) {
  // Add this check
  const enforcement = await checkLicenseEnforcement(request);
  if (!enforcement.allowed) {
    return NextResponse.json(
      { 
        error: enforcement.error?.code,
        message: enforcement.error?.message,
        details: enforcement.error?.details 
      },
      { status: 403 }
    );
  }

  // Your existing code here
  return NextResponse.json({ data: "..." });
}
```

## Step 3: Test

1. **As Owner**: Go to Settings → Security & Licensing
2. **Register Device**: Click "Register This Device" (if not registered)
3. **Set IP**: Click "Set to My Current IP"
4. **Test Access**: Try accessing protected routes

## Step 4: Verify Enforcement

### Test Device Lock:
1. Register device on Browser A
2. Try accessing from Browser B → Should be blocked with "DEVICE_MISMATCH"

### Test IP Lock:
1. Set allowed IP to `192.168.1.100`
2. Access from different IP → Should be blocked with "IP_NOT_ALLOWED"

## Common Routes to Protect

Add licensing to these routes:
- `/api/inventory/*`
- `/api/pos/*`
- `/api/invoices/*`
- `/api/dashboard/*`
- `/api/reports/*`

## Error Handling in Frontend

```typescript
// Handle licensing errors in your API calls
try {
  const res = await fetch('/api/inventory/items');
  if (!res.ok) {
    const error = await res.json();
    if (error.error === 'DEVICE_MISMATCH' || error.error === 'IP_NOT_ALLOWED') {
      // Redirect to settings
      router.push('/settings?tab=licensing');
      alert('Please update your device/IP settings');
    }
  }
} catch (error) {
  // Handle error
}
```

## That's It!

Your licensing enforcement is now active. All checks are:
- ✅ Server-side
- ✅ Auditable
- ✅ Revocable
- ✅ Owner-controlled

See `LICENSING_ENFORCEMENT.md` for full documentation.
