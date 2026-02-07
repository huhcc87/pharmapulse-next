/**
 * Licence Validation at Login
 * 
 * Validates licence status, device fingerprint, and IP address
 * before allowing user to log in.
 */

import { prisma } from "@/lib/prisma";
import { getDaysRemaining } from "./licence-utils";
import { checkGracePeriod } from "./grace-period";
import { determineAccessLevel, AccessLevel } from "./read-only-mode";
import { isRateLimited, recordValidationFailure, clearRateLimit } from "./rate-limit";

export interface LicenceValidationContext {
  tenantId: string;
  userId: string;
  deviceId: string;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
}

export interface LicenceValidationResult {
  allowed: boolean;
  reason?: string;
  licenceId?: string;
  status?: string;
  expiresAt?: Date | null;
  daysRemaining?: number | null;
  accessLevel?: AccessLevel;
  inGracePeriod?: boolean;
  violationType?: string;
}

/**
 * Validate licence at login time
 * 
 * Checks:
 * 1. Licence exists and is active (not expired)
 * 2. If device fingerprint is registered, it must match
 * 3. If IP is registered, it must match
 */
export async function validateLicenceAtLogin(
  context: LicenceValidationContext
): Promise<LicenceValidationResult> {
  const { tenantId, deviceId, deviceFingerprint, ipAddress } = context;

  // Check rate limiting (based on IP + device combination)
  const rateLimitKey = `${ipAddress}:${deviceId}`;
  if (isRateLimited(rateLimitKey)) {
    return {
      allowed: false,
      reason: "Too many failed validation attempts. Please try again later.",
      violationType: "RATE_LIMITED",
    };
  }

  // Fetch licence
  const licence = await prisma.license.findUnique({
    where: { tenantId },
  });

  if (!licence) {
    // No licence exists - allow access (may need initial setup)
    // In production, you might want to deny access here
    clearRateLimit(rateLimitKey);
    return {
      allowed: true,
      reason: "No licence found - access allowed for initial setup",
    };
  }

  const now = new Date();

  // Check grace period
  const graceStatus = await checkGracePeriod(licence);
  
  // Check status first
  if (licence.status === "suspended") {
    // Track violation
    await trackViolation(tenantId, licence.id, "SUSPENDED", "Licence has been suspended", ipAddress, deviceId, deviceFingerprint, userAgent);
    
    return {
      allowed: false,
      reason: "Licence has been suspended. Please contact support.",
      licenceId: licence.id,
      status: licence.status,
      accessLevel: AccessLevel.BLOCKED,
      violationType: "SUSPENDED",
    };
  }

  // Determine access level
  const accessLevel = determineAccessLevel(
    licence.status,
    graceStatus.expired,
    graceStatus.inGrace,
    graceStatus.daysInGrace
  );

  // Update last validated time (only if allowed)
  if (accessLevel.accessLevel === AccessLevel.FULL || accessLevel.accessLevel === AccessLevel.READ_ONLY) {
    await prisma.license.update({
      where: { id: licence.id },
      data: {
        lastValidatedAt: new Date(),
        validationCount: { increment: 1 },
      },
    });
  }

  // Check if expired (outside grace)
  if (graceStatus.expired && !graceStatus.inGrace) {
    // Track violation
    await trackViolation(tenantId, licence.id, "EXPIRED", "Licence has expired", ipAddress, deviceId, deviceFingerprint, userAgent);
    
    // Allow read-only access
    return {
      allowed: true, // Allow login but in read-only mode
      reason: accessLevel.reason || "Licence has expired. Read-only access only.",
      licenceId: licence.id,
      status: licence.status,
      expiresAt: licence.expiresAt,
      daysRemaining: 0,
      accessLevel: AccessLevel.READ_ONLY,
      violationType: "EXPIRED",
    };
  }

  if (licence.status === "expired" && graceStatus.inGrace) {
    // In grace period - allow with warning
    return {
      allowed: true,
      reason: accessLevel.reason || `Licence expired. In grace period (${graceStatus.daysInGrace} days remaining).`,
      licenceId: licence.id,
      status: licence.status,
      expiresAt: licence.expiresAt,
      daysRemaining: graceStatus.daysInGrace,
      accessLevel: AccessLevel.READ_ONLY,
      inGracePeriod: true,
    };
  }

  if (licence.status === "pending_renewal") {
    // Allow read-only access
    return {
      allowed: true,
      reason: "Licence is pending renewal. Read-only access only.",
      licenceId: licence.id,
      status: licence.status,
      expiresAt: licence.expiresAt,
      daysRemaining: getDaysRemaining(licence.expiresAt),
      accessLevel: AccessLevel.READ_ONLY,
    };
  }

  // If device fingerprint is registered, it must match
  if (licence.registeredDeviceFingerprint) {
    if (licence.registeredDeviceFingerprint !== deviceFingerprint) {
      // Record rate limit failure
      recordValidationFailure(rateLimitKey);
      
      // Track violation
      await trackViolation(tenantId, licence.id, "DEVICE_MISMATCH", "Device fingerprint does not match registered device", ipAddress, deviceId, deviceFingerprint, userAgent);
      
      return {
        allowed: false,
        reason: "Device mismatch. This device is not registered for this licence. Please use your registered device or register this device in Settings.",
        licenceId: licence.id,
        status: licence.status,
        accessLevel: AccessLevel.BLOCKED,
        violationType: "DEVICE_MISMATCH",
      };
    }
  }

  // If IP is registered, it must match (check both registeredIp and allowedIp for compatibility)
  const registeredIP = licence.registeredIp || licence.allowedIp;
  if (registeredIP) {
    if (registeredIP !== ipAddress) {
      // Record rate limit failure
      recordValidationFailure(rateLimitKey);
      
      // Track violation
      await trackViolation(tenantId, licence.id, "IP_MISMATCH", `IP address mismatch. Current: ${ipAddress}, Expected: ${registeredIP}`, ipAddress, deviceId, deviceFingerprint, userAgent);
      
      return {
        allowed: false,
        reason: `IP address mismatch. Your current IP (${ipAddress}) does not match the registered IP (${registeredIP}). Please use your registered IP or update it in Settings.`,
        licenceId: licence.id,
        status: licence.status,
        accessLevel: AccessLevel.BLOCKED,
        violationType: "IP_MISMATCH",
      };
    }
  }

  // All checks passed - clear rate limit
  clearRateLimit(rateLimitKey);
  
  return {
    allowed: true,
    licenceId: licence.id,
    status: licence.status,
    expiresAt: licence.expiresAt,
    daysRemaining: getDaysRemaining(licence.expiresAt),
    accessLevel: AccessLevel.FULL,
    inGracePeriod: graceStatus.inGrace,
  };
}

/**
 * Track licence violation
 */
async function trackViolation(
  tenantId: string,
  licenceId: string,
  violationType: string,
  reason: string,
  ipAddress: string,
  deviceId: string,
  deviceFingerprint: string,
  userAgent: string
): Promise<void> {
  try {
    // Create violation record
    await prisma.licenseViolation.create({
      data: {
        tenantId,
        licenceId,
        violationType,
        reason,
        ipAddress,
        deviceId,
        deviceFingerprint,
        userAgent,
      },
    });

    // Update licence violation count
    await prisma.license.update({
      where: { id: licenceId },
      data: {
        lastViolationAt: new Date(),
        violationCount: { increment: 1 },
      },
    });
  } catch (error) {
    console.error("Failed to track violation:", error);
    // Don't throw - violation tracking shouldn't block login
  }
}
