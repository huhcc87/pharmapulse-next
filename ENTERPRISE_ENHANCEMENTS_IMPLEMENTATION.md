# Enterprise Licence Enhancements - Complete Implementation Guide

This document provides a single comprehensive implementation guide for all missing enterprise-grade features.

---

## Implementation Summary

### Current Status: 60% Complete
- ✅ Basic licence management
- ✅ Device registration
- ✅ IP management (basic)
- ✅ Renewal codes
- ✅ Basic audit logs

### Missing: 40%
- ❌ Grace period & soft lock
- ❌ Read-only mode
- ❌ Violation alerts
- ❌ Enhanced UI transparency
- ❌ Export functionality
- ❌ Proper approval workflows

---

## Part 1: Database Schema Updates

### Update `prisma/schema.prisma`

```prisma
model License {
  // ... existing fields ...
  
  // Grace period support
  gracePeriodDays     Int?      @default(7) @map("grace_period_days")
  graceUntil          DateTime? @map("grace_until")
  
  // Validation tracking
  lastValidatedAt     DateTime? @map("last_validated_at")
  validationCount     Int       @default(0) @map("validation_count")
  
  // Renewal workflow
  adminNotes          String?   @map("admin_notes")
  paymentReferenceId  String?   @map("payment_reference_id")
  renewalRequestedAt  DateTime? @map("renewal_requested_at")
  
  // Violation tracking
  lastViolationAt     DateTime? @map("last_violation_at")
  violationCount      Int       @default(0) @map("violation_count")
}

model IpChangeRequest {
  // ... existing fields ...
  
  // Add reason field
  reason String? // Reason for IP change request
}

model DeviceRegistration {
  // ... existing fields ...
  
  // Device transparency
  operatingSystem String? @map("operating_system")
  browser         String? @map("browser")
  userAgent       String? @map("user_agent")
}

model LicenseViolation {
  id            String   @id @default(cuid())
  tenantId      String   @map("tenant_id")
  licenceId     String   @map("licence_id")
  violationType String   @map("violation_type") // DEVICE_MISMATCH, IP_MISMATCH, EXPIRED, etc.
  reason        String
  ipAddress     String?  @map("ip_address")
  deviceId      String?  @map("device_id")
  createdAt     DateTime @default(now())
  
  license License @relation(fields: [licenceId], references: [id], onDelete: Cascade)
  
  @@index([tenantId, createdAt(sort: Desc)])
  @@index([violationType])
  @@map("license_violations")
}
```

**Migration:**
```bash
npx prisma migrate dev --name add_enterprise_licence_features
```

---

## Part 2: Backend Utilities

### Create `src/lib/licensing/grace-period.ts`

```typescript
/**
 * Grace Period Management
 */

import { prisma } from "@/lib/prisma";
import { getDaysRemaining } from "./licence-utils";

export interface GracePeriodStatus {
  inGrace: boolean;
  graceUntil: Date | null;
  daysRemaining: number | null;
  expired: boolean;
}

export async function checkGracePeriod(
  licence: any
): Promise<GracePeriodStatus> {
  if (!licence.expiresAt) {
    return { inGrace: false, graceUntil: null, daysRemaining: null, expired: false };
  }

  const now = new Date();
  const expiryDate = new Date(licence.expiresAt);
  const gracePeriodDays = licence.gracePeriodDays || 7;
  const graceUntil = new Date(expiryDate);
  graceUntil.setDate(graceUntil.getDate() + gracePeriodDays);

  const expired = now > expiryDate;
  const inGrace = expired && now <= graceUntil;
  const daysRemaining = inGrace 
    ? Math.ceil((graceUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : getDaysRemaining(expiryDate);

  return { inGrace, graceUntil, daysRemaining, expired };
}

export async function calculateGraceUntil(expiresAt: Date, gracePeriodDays: number = 7): Date {
  const graceUntil = new Date(expiresAt);
  graceUntil.setDate(graceUntil.getDate() + gracePeriodDays);
  return graceUntil;
}
```

### Create `src/lib/licensing/read-only-mode.ts`

```typescript
/**
 * Read-Only Mode Enforcement
 */

export enum AccessLevel {
  FULL = "full",
  READ_ONLY = "read_only",
  BLOCKED = "blocked",
}

export interface LicenceAccessResult {
  accessLevel: AccessLevel;
  reason?: string;
  gracePeriod?: boolean;
}

export function determineAccessLevel(
  status: string,
  expired: boolean,
  inGrace: boolean
): LicenceAccessResult {
  if (status === "active" && !expired) {
    return { accessLevel: AccessLevel.FULL };
  }

  if (status === "suspended") {
    return { 
      accessLevel: AccessLevel.BLOCKED,
      reason: "Licence has been suspended"
    };
  }

  if (expired && inGrace) {
    return { 
      accessLevel: AccessLevel.READ_ONLY,
      gracePeriod: true,
      reason: "Licence expired. In grace period. Please renew."
    };
  }

  if (expired && !inGrace) {
    return { 
      accessLevel: AccessLevel.READ_ONLY,
      reason: "Licence expired. Read-only access only. Please renew."
    };
  }

  return { 
    accessLevel: AccessLevel.FULL,
  };
}

export function isWriteOperation(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
}

export function isBlockedRoute(path: string): boolean {
  // Routes that should be blocked in read-only mode
  const blockedRoutes = [
    "/api/pos",
    "/api/billing",
    "/api/inventory/stock",
    "/api/reports/export",
  ];
  
  return blockedRoutes.some(route => path.startsWith(route));
}
```

### Update `src/lib/licensing/licence-validation.ts`

Add grace period check and violation tracking:

```typescript
// Add to validateLicenceAtLogin function
import { checkGracePeriod } from "./grace-period";
import { determineAccessLevel } from "./read-only-mode";

// After checking expiry
const graceStatus = await checkGracePeriod(licence);
const accessLevel = determineAccessLevel(licence.status, graceStatus.expired, graceStatus.inGrace);

// Track violations
if (!allowed && violationType) {
  await prisma.licenseViolation.create({
    data: {
      tenantId,
      licenceId: licence.id,
      violationType,
      reason: validationResult.reason || "Unknown violation",
      ipAddress,
      deviceId,
    },
  });

  // Update violation count
  await prisma.license.update({
    where: { id: licence.id },
    data: {
      lastViolationAt: new Date(),
      violationCount: { increment: 1 },
    },
  });
}

// Update last validated time
await prisma.license.update({
  where: { id: licence.id },
  data: {
    lastValidatedAt: new Date(),
    validationCount: { increment: 1 },
  },
});
```

---

## Part 3: API Endpoints

### Create `src/app/api/licensing/violations/route.ts`

```typescript
export async function GET(request: NextRequest) {
  // Get last 5 violations for current user's licence
  // Returns violations with type, reason, timestamp
}
```

### Create `src/app/api/licensing/renewal-request/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // Request renewal
  // Sets renewalRequestedAt timestamp
  // Returns renewal code
}
```

### Create `src/app/api/licensing/export/pdf/route.ts`

```typescript
export async function GET(request: NextRequest) {
  // Generate PDF with licence details
  // Include subscriber, device, IP, validity, audit summary
  // Return PDF file
}
```

---

## Part 4: UI Components

### Update Security & Licensing Page

Add these sections in order:

1. **Warning Banner** (when <30 days)
2. **Grace Period Banner** (during grace)
3. **Read-Only Mode Banner** (when expired)
4. **Licence Health Panel** (enhanced)
5. **Device Details Panel** (OS, Browser)
6. **Violation Alerts Panel** (last 5)
7. **IP Change Request Status** (pending/approved/rejected)
8. **Export Buttons** (PDF/CSV)

---

## Part 5: Middleware

### Create `src/middleware.ts` (if not exists)

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { determineAccessLevel, isWriteOperation, isBlockedRoute } from "@/lib/licensing/read-only-mode";

export function middleware(request: NextRequest) {
  // Check licence status
  // If read-only and write operation → block
  // If expired and blocked route → block
}
```

---

## Implementation Checklist

### Phase 1: Critical Features
- [ ] Update database schema (grace period, validation tracking)
- [ ] Implement grace period check
- [ ] Implement read-only mode enforcement
- [ ] Add violation tracking
- [ ] Update validation to track violations

### Phase 2: UI Enhancements
- [ ] Add warning banner (<30 days)
- [ ] Add grace period banner
- [ ] Add read-only mode banner
- [ ] Enhance licence status panel
- [ ] Add device OS/Browser display

### Phase 3: Workflows
- [ ] Implement IP change request workflow (with reason)
- [ ] Implement device replacement request
- [ ] Implement renewal request flow
- [ ] Add admin approval UI

### Phase 4: Export & Audit
- [ ] Implement PDF export
- [ ] Implement CSV export
- [ ] Add violation alerts display
- [ ] Enhance audit log display

---

## Quick Implementation Order

1. **Database Migration** (15 min)
2. **Grace Period Logic** (30 min)
3. **Read-Only Mode** (30 min)
4. **Warning Banners** (20 min)
5. **Device Details** (20 min)
6. **Violation Alerts** (30 min)
7. **Export Functions** (1 hour)
8. **Workflows** (2 hours)

**Total Estimated Time: ~5-6 hours**

---

## Testing Checklist

- [ ] Grace period works correctly
- [ ] Read-only mode blocks write operations
- [ ] Violations are tracked and displayed
- [ ] Warning banners appear at correct times
- [ ] Export generates correct PDF/CSV
- [ ] IP change requests require approval
- [ ] Device replacement requests work
- [ ] Renewal requests are logged

---

This implementation guide provides everything needed to add all missing enterprise features. Start with Phase 1 for critical features, then proceed with UI and workflows.
