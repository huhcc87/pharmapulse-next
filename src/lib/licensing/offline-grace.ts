/**
 * Offline Grace Period System
 * 
 * Allows cached entitlements to be used for 48-72 hours offline.
 * First-time activation must be online.
 * Expired grace → limited mode.
 */

import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth/jwt";
import type { JWTPayload } from "@/lib/auth/jwt";

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
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + GRACE_PERIOD_SECONDS);

  await prisma.cachedEntitlement.upsert({
    where: {
      orgId_licenseId_deviceId: {
        orgId,
        licenseId,
        deviceId,
      },
    },
    create: {
      orgId,
      licenseId,
      deviceId,
      entitlementToken,
      expiresAt,
      lastValidatedAt: new Date(),
      validationCount: 1,
      isValid: true,
    },
    update: {
      entitlementToken,
      expiresAt,
      lastValidatedAt: new Date(),
      validationCount: {
        increment: 1,
      },
      isValid: true,
      invalidatedAt: null,
      invalidatedReason: null,
    },
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
  const cached = await prisma.cachedEntitlement.findUnique({
    where: {
      orgId_licenseId_deviceId: {
        orgId,
        licenseId,
        deviceId,
      },
    },
  });

  if (!cached || !cached.isValid) {
    return null;
  }

  // Check if expired
  if (cached.expiresAt < new Date()) {
    // Mark as invalid
    await prisma.cachedEntitlement.update({
      where: { id: cached.id },
      data: {
        isValid: false,
        invalidatedAt: new Date(),
        invalidatedReason: "Grace period expired",
      },
    });
    return null;
  }

  // Verify token is still valid (basic check)
  const payload = verifyAccessToken(cached.entitlementToken);
  if (!payload) {
    // Token invalid, mark cache as invalid
    await prisma.cachedEntitlement.update({
      where: { id: cached.id },
      data: {
        isValid: false,
        invalidatedAt: new Date(),
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
    cachedAt: cached.cachedAt,
    lastValidatedAt: cached.lastValidatedAt,
  };
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

  if (!cached) {
    return { valid: false, limitedMode: true };
  }

  // If online, update validation timestamp
  if (isOnline) {
    await prisma.cachedEntitlement.update({
      where: {
        orgId_licenseId_deviceId: {
          orgId,
          licenseId,
          deviceId,
        },
      },
      data: {
        lastValidatedAt: new Date(),
        validationCount: {
          increment: 1,
        },
      },
    });
  }

  // Check if grace period expired
  const now = new Date();
  const timeSinceValidation = now.getTime() - cached.lastValidatedAt.getTime();
  const gracePeriodMs = GRACE_PERIOD_SECONDS * 1000;

  if (timeSinceValidation > gracePeriodMs) {
    return { valid: false, limitedMode: true };
  }

  // Check if cache expires soon (within 24h)
  const timeUntilExpiry = cached.expiresAt.getTime() - now.getTime();
  const warningThreshold = 24 * 60 * 60 * 1000; // 24 hours

  if (timeUntilExpiry < warningThreshold && !isOnline) {
    // Still valid but warning
    return { valid: true, limitedMode: false };
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
  await prisma.cachedEntitlement.updateMany({
    where: {
      orgId,
      licenseId,
      deviceId,
      isValid: true,
    },
    data: {
      isValid: false,
      invalidatedAt: new Date(),
      invalidatedReason: reason,
    },
  });
}

/**
 * Check if device has ever been online (first-time activation check)
 */
export async function hasEverBeenOnline(
  orgId: string,
  licenseId: string,
  deviceId: string
): Promise<boolean> {
  const cached = await prisma.cachedEntitlement.findUnique({
    where: {
      orgId_licenseId_deviceId: {
        orgId,
        licenseId,
        deviceId,
      },
    },
  });

  // If cache exists and has been validated, device has been online
  return cached !== null && cached.validationCount > 0;
}

/**
 * Cleanup expired cached entitlements (run periodically)
 */
export async function cleanupExpiredCachedEntitlements(): Promise<number> {
  const result = await prisma.cachedEntitlement.updateMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
      isValid: true,
    },
    data: {
      isValid: false,
      invalidatedAt: new Date(),
      invalidatedReason: "Expired during cleanup",
    },
  });

  return result.count;
}
