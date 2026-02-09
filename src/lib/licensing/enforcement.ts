/**
 * Enterprise Licensing Enforcement Middleware
 *
 * Enforces:
 * 1. License exists and is active
 * 2. IP address matches allowed IP (if set)
 * 3. Device ID matches registered device (1 PC per tenant)
 *
 * All checks are server-side and auditable.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { extractClientIP, compareIPs } from "./ip-extraction";
import { getOrCreateDeviceId, generateDeviceFingerprint } from "./device-id";

export interface LicenseEnforcementResult {
  allowed: boolean;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export interface LicenseCheckContext {
  tenantId: string;
  userId: string;
  userRole: string;
  requestIP: string | null; // IMPORTANT: use null (not undefined) for “missing”
  deviceId: string;
  route: string;
  userAgent: string | null;
}

/**
 * Main licensing enforcement function
 */
export async function enforceLicense(
  context: LicenseCheckContext
): Promise<LicenseEnforcementResult> {
  const { tenantId, userId, userRole, requestIP, deviceId, route, userAgent } =
    context;

  try {
    // 1. Check license exists and is active
    const license = await prisma.license.findUnique({
      where: { tenantId },
    });

    if (!license) {
      await logLicenseAction(tenantId, userId, "LOGIN_BLOCKED_NO_LICENSE", {
        route,
        ip: requestIP,
        deviceId,
        reason: "License not found",
      });

      return {
        allowed: false,
        error: {
          code: "LICENSE_NOT_FOUND",
          message: "No license found for this tenant. Please contact support.",
        },
      };
    }

    if (license.status !== "active") {
      await logLicenseAction(
        tenantId,
        userId,
        "LOGIN_BLOCKED_LICENSE_INACTIVE",
        {
          route,
          ip: requestIP,
          deviceId,
          reason: `License status: ${license.status}`,
        }
      );

      return {
        allowed: false,
        error: {
          code: "LICENSE_INACTIVE",
          message: `License is ${license.status}. Please renew your subscription.`,
          details: { status: license.status },
        },
      };
    }

    // 2. Check IP policy (if allowed_ip is set)
    if (license.allowedIp) {
      if (!requestIP) {
        await logLicenseAction(tenantId, userId, "LOGIN_BLOCKED_IP_UNKNOWN", {
          route,
          deviceId,
          reason: "Could not determine client IP",
        });

        return {
          allowed: false,
          error: {
            code: "IP_NOT_DETECTED",
            message:
              "Could not determine your IP address. Please contact support.",
          },
        };
      }

      if (!compareIPs(requestIP, license.allowedIp)) {
        const maskedAllowed = maskIP(license.allowedIp);
        const maskedRequest = maskIP(requestIP);

        await logLicenseAction(tenantId, userId, "LOGIN_BLOCKED_IP", {
          route,
          ip: requestIP,
          allowedIp: license.allowedIp,
          deviceId,
          reason: `IP mismatch: ${requestIP} != ${license.allowedIp}`,
        });

        return {
          allowed: false,
          error: {
            code: "IP_NOT_ALLOWED",
            message: "Your IP address is not authorized for this license.",
            details: {
              currentIp: maskedRequest,
              allowedIp: maskedAllowed,
            },
          },
        };
      }
    }

    // 3. Check device policy (only one active device per tenant)
    const activeDevice = await prisma.deviceRegistration.findFirst({
      where: {
        tenantId,
        revokedAt: null,
      },
      orderBy: {
        registeredAt: "desc",
      },
    });

    if (!activeDevice) {
      // No device registered yet - allow registration only for Owner/Admin
      if (userRole !== "owner" && userRole !== "super_admin") {
        await logLicenseAction(
          tenantId,
          userId,
          "LOGIN_BLOCKED_DEVICE_REG_REQUIRED",
          {
            route,
            ip: requestIP,
            deviceId,
            reason: "No device registered and user is not owner/admin",
          }
        );

        return {
          allowed: false,
          error: {
            code: "OWNER_REQUIRED_FOR_FIRST_DEVICE_REG",
            message:
              "No device is registered for this license. Only the owner can register the first device. Please contact the owner.",
          },
        };
      }

      // Owner/Admin can register first device
      const fingerprint = generateDeviceFingerprint(userAgent, new Headers());

      await prisma.deviceRegistration.create({
        data: {
          tenantId,
          userId,
          deviceId,
          deviceType: "web",
          deviceLabel: "Primary Device",
          registeredIp: requestIP, // string | null ✅
        },
      });

      await logLicenseAction(tenantId, userId, "DEVICE_REGISTERED", {
        route,
        ip: requestIP,
        deviceId,
        fingerprint,
        reason: "First device auto-registered by owner",
      });

      // Update license checkin
      await prisma.license.update({
        where: { id: license.id },
        data: { lastCheckinAt: new Date() },
      });

      return { allowed: true };
    }

    // Device exists - check if it matches
    if (activeDevice.deviceId !== deviceId) {
      await logLicenseAction(tenantId, userId, "LOGIN_BLOCKED_DEVICE", {
        route,
        ip: requestIP,
        deviceId,
        activeDeviceId: activeDevice.deviceId,
        activeDeviceLabel: activeDevice.deviceLabel,
        reason: `Device mismatch: ${deviceId} != ${activeDevice.deviceId}`,
      });

      return {
        allowed: false,
        error: {
          code: "DEVICE_MISMATCH",
          message: "This license is locked to another device.",
          details: {
            activeDeviceLabel:
              activeDevice.deviceLabel || "Registered Device",
            registeredAt: activeDevice.registeredAt.toISOString(),
          },
        },
      };
    }

    // All checks passed - update last seen (throttled to once per 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (!activeDevice.lastSeenAt || activeDevice.lastSeenAt < fiveMinutesAgo) {
      await prisma.deviceRegistration.update({
        where: { id: activeDevice.id },
        data: { lastSeenAt: new Date() },
      });
    }

    // Update license checkin (throttled)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (!license.lastCheckinAt || license.lastCheckinAt < oneHourAgo) {
      await prisma.license.update({
        where: { id: license.id },
        data: { lastCheckinAt: new Date() },
      });
    }

    return { allowed: true };
  } catch (error: any) {
    console.error("License enforcement error:", error);

    await logLicenseAction(tenantId, userId, "LICENSE_CHECK_ERROR", {
      route,
      ip: requestIP,
      deviceId,
      error: error?.message,
    });

    return {
      allowed: false,
      error: {
        code: "ENFORCEMENT_ERROR",
        message:
          "An error occurred during license verification. Please try again.",
      },
    };
  }
}

/**
 * Mask IP address for display (security)
 * Shows first 2 octets: 192.168.x.x
 */
function maskIP(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.x.x`;
  }
  return "x.x.x.x";
}

/**
 * Log license action to audit log
 */
async function logLicenseAction(
  tenantId: string,
  actorUserId: string | null,
  action: string,
  meta: Record<string, any>
): Promise<void> {
  try {
    await prisma.licenseAuditLog.create({
      data: {
        tenantId,
        actorUserId: actorUserId || null,
        action,
        meta,
      },
    });
  } catch (error) {
    // Don't fail the request if audit log fails
    console.error("Failed to log license action:", error);
  }
}

/**
 * Middleware wrapper for Next.js API routes
 */
export async function checkLicenseEnforcement(
  request: NextRequest
): Promise<LicenseEnforcementResult> {
  const user = await getSessionUser();
  if (!user) {
    return {
      allowed: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    };
  }

  // Normalize potentially-undefined values into the exact types our context expects
  const requestIP = extractClientIP(request) ?? null; // ✅ FIX (undefined -> null)
  const deviceId = await getOrCreateDeviceId();
  const userAgent = request.headers.get("user-agent");
  const route = request.nextUrl.pathname;

  return await enforceLicense({
    tenantId: user.tenantId,
    userId: user.userId,
    userRole: user.role,
    requestIP,
    deviceId,
    route,
    userAgent,
  });
}
