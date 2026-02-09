/**
 * Offline Grace Period System
 *
 * Allows cached entitlements to be used for 48-72 hours offline.
 * First-time activation must be online.
 * Expired grace → limited mode.
 *
 * NOTE:
 * Some deployments may not have a Prisma model for CachedEntitlement.
 * If prisma.cachedEntitlement doesn't exist, we fall back to an in-memory cache
 * to keep builds green and behavior functional (best-effort) until DB model is added.
 */

import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth/jwt";

const GRACE_PERIOD_HOURS = 72; // 3 days
const GRACE_PERIOD_SECONDS = GRACE_PERIOD_HOURS * 60 * 60;

export interface CachedEntitlement {
  orgId: string;
  licenseId: string;
  deviceId: string;
  entitlementToken: string;
  expiresAt: Date;
  cachedAt: Date;
  lastValidatedAt: Date;
  validationCount: number;
  isValid: boolean;
  invalidatedAt?: Date | null;
  invalidatedReason?: string | null;
}

/**
 * In-memory fallback store (process-local)
 * Key = orgId|licenseId|deviceId
 */
const memStore = new Map<string, CachedEntitlement>();

function keyOf(orgId: string, licenseId: string, deviceId: string) {
  return `${orgId}|${licenseId}|${deviceId}`;
}

/**
 * Runtime check: does Prisma client expose cachedEntitlement model?
 */
function hasDbModel(): boolean {
  return typeof (prisma as any)?.cachedEntitlement?.findUnique === "function";
}

/**
 * Cache entitlement for offline grace period
 */
export async function cacheEntitlement(
  orgId: string,
  licenseId: string,
  deviceId: string,
  entitlementToken: string
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + GRACE_PERIOD_SECONDS * 1000);

  // DB path (if model exists)
  if (hasDbModel()) {
    await (prisma as any).cachedEntitlement.upsert({
      where: {
        orgId_licenseId_deviceId: { orgId, licenseId, deviceId },
      },
      create: {
        orgId,
        licenseId,
        deviceId,
        entitlementToken,
        expiresAt,
        cachedAt: now,
        lastValidatedAt: now,
        validationCount: 1,
        isValid: true,
        invalidatedAt: null,
        invalidatedReason: null,
      },
      update: {
        entitlementToken,
        expiresAt,
        lastValidatedAt: now,
        validationCount: { increment: 1 },
        isValid: true,
        invalidatedAt: null,
        invalidatedReason: null,
      },
    });
    return;
  }

  // Fallback path (in-memory)
  const k = keyOf(orgId, licenseId, deviceId);
  const prev = memStore.get(k);

  memStore.set(k, {
    orgId,
    licenseId,
    deviceId,
    entitlementToken,
    expiresAt,
    cachedAt: prev?.cachedAt ?? now,
    lastValidatedAt: now,
    validationCount: (prev?.validationCount ?? 0) + 1,
    isValid: true,
    invalidatedAt: null,
    invalidatedReason: null,
  });
}

/**
 * Get cached entitlement for offline use
 * Returns null if expired or invalid
 */
export async function getCachedEntitlement(
  orgId: string,
  licenseId: string,
  deviceId: string
): Promise<CachedEntitlement | null> {
  const now = new Date();

  // DB path
  if (hasDbModel()) {
    const cached = await (prisma as any).cachedEntitlement.findUnique({
      where: {
        orgId_licenseId_deviceId: { orgId, licenseId, deviceId },
      },
    });

    if (!cached || !cached.isValid) return null;

    // Expired -> invalidate
    if (cached.expiresAt < now) {
      await (prisma as any).cachedEntitlement.update({
        where: { id: cached.id },
        data: {
          isValid: false,
          invalidatedAt: now,
          invalidatedReason: "Grace period expired",
        },
      });
      return null;
    }

    // Verify token (basic check)
    const payload = verifyAccessToken(cached.entitlementToken);
    if (!payload) {
      await (prisma as any).cachedEntitlement.update({
        where: { id: cached.id },
        data: {
          isValid: false,
          invalidatedAt: now,
          invalidatedReason: "Entitlement token invalid",
        },
      });
      return null;
    }

    return {
      orgId: cached.orgId,
      licenseId: cached.licenseId,
      deviceId: cached.deviceId,
      entitlementToken: cached.entitlementToken,
      expiresAt: cached.expiresAt,
      cachedAt: cached.cachedAt ?? cached.createdAt ?? now, // tolerate schema differences
      lastValidatedAt: cached.lastValidatedAt ?? now,
      validationCount: cached.validationCount ?? 0,
      isValid: cached.isValid,
      invalidatedAt: cached.invalidatedAt ?? null,
      invalidatedReason: cached.invalidatedReason ?? null,
    };
  }

  // Fallback path
  const k = keyOf(orgId, licenseId, deviceId);
  const cached = memStore.get(k);
  if (!cached || !cached.isValid) return null;

  if (cached.expiresAt < now) {
    memStore.set(k, {
      ...cached,
      isValid: false,
      invalidatedAt: now,
      invalidatedReason: "Grace period expired",
    });
    return null;
  }

  const payload = verifyAccessToken(cached.entitlementToken);
  if (!payload) {
    memStore.set(k, {
      ...cached,
      isValid: false,
      invalidatedAt: now,
      invalidatedReason: "Entitlement token invalid",
    });
    return null;
  }

  return cached;
}

/**
 * Validate cached entitlement (online check)
 * Updates lastValidatedAt if valid
 */
export async function validateCachedEntitlement(
  orgId: string,
  licenseId: string,
  deviceId: string,
  isOnline: boolean
): Promise<{ valid: boolean; limitedMode: boolean }> {
  const cached = await getCachedEntitlement(orgId, licenseId, deviceId);
  if (!cached) return { valid: false, limitedMode: true };

  const now = new Date();

  // If online, refresh lastValidatedAt
  if (isOnline) {
    if (hasDbModel()) {
      await (prisma as any).cachedEntitlement.update({
        where: { orgId_licenseId_deviceId: { orgId, licenseId, deviceId } },
        data: {
          lastValidatedAt: now,
          validationCount: { increment: 1 },
        },
      });
    } else {
      const k = keyOf(orgId, licenseId, deviceId);
      const prev = memStore.get(k);
      if (prev) {
        memStore.set(k, {
          ...prev,
          lastValidatedAt: now,
          validationCount: prev.validationCount + 1,
        });
      }
    }
  }

  // Enforce grace window based on last validation time
  const timeSinceValidation = now.getTime() - cached.lastValidatedAt.getTime();
  const gracePeriodMs = GRACE_PERIOD_SECONDS * 1000;

  if (timeSinceValidation > gracePeriodMs) {
    return { valid: false, limitedMode: true };
  }

  return { valid: true, limitedMode: false };
}

/**
 * Invalidate cached entitlement (e.g., on license revoke)
 */
export async function invalidateCachedEntitlement(
  orgId: string,
  licenseId: string,
  deviceId: string,
  reason: string
): Promise<void> {
  const now = new Date();

  if (hasDbModel()) {
    await (prisma as any).cachedEntitlement.updateMany({
      where: { orgId, licenseId, deviceId, isValid: true },
      data: {
        isValid: false,
        invalidatedAt: now,
        invalidatedReason: reason,
      },
    });
    return;
  }

  const k = keyOf(orgId, licenseId, deviceId);
  const prev = memStore.get(k);
  if (prev) {
    memStore.set(k, {
      ...prev,
      isValid: false,
      invalidatedAt: now,
      invalidatedReason: reason,
    });
  }
}

/**
 * Check if device has ever been online (first-time activation check)
 */
export async function hasEverBeenOnline(
  orgId: string,
  licenseId: string,
  deviceId: string
): Promise<boolean> {
  if (hasDbModel()) {
    const cached = await (prisma as any).cachedEntitlement.findUnique({
      where: { orgId_licenseId_deviceId: { orgId, licenseId, deviceId } },
      select: { validationCount: true },
    });
    return !!cached && (cached.validationCount ?? 0) > 0;
  }

  const cached = memStore.get(keyOf(orgId, licenseId, deviceId));
  return !!cached && cached.validationCount > 0;
}

/**
 * Cleanup expired cached entitlements (run periodically)
 */
export async function cleanupExpiredCachedEntitlements(): Promise<number> {
  const now = new Date();

  if (hasDbModel()) {
    const result = await (prisma as any).cachedEntitlement.updateMany({
      where: {
        expiresAt: { lt: now },
        isValid: true,
      },
      data: {
        isValid: false,
        invalidatedAt: now,
        invalidatedReason: "Expired during cleanup",
      },
    });
    return result.count ?? 0;
  }

  // In-memory cleanup (avoid iterating MapIterator with for..of for older TS targets)
  let count = 0;
  memStore.forEach((v, k) => {
    if (v.isValid && v.expiresAt < now) {
      memStore.set(k, {
        ...v,
        isValid: false,
        invalidatedAt: now,
        invalidatedReason: "Expired during cleanup",
      });
      count++;
    }
  });

  return count;
}
