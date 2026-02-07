/**
 * Licence Management API
 * 
 * Endpoints:
 * - GET: Get current user's licence
 * - POST: Register device, renew licence, etc.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { extractClientIP } from "@/lib/licensing/ip-extraction";
import { getOrCreateDeviceId } from "@/lib/licensing/device-id";
import { 
  generateDeviceFingerprintFromHeaders,
  generateLicenceKey,
  generateRenewalCode,
  maskLicenceKey,
  getDaysRemaining,
} from "@/lib/licensing/licence-utils";
import { extractDeviceInfo } from "@/lib/licensing/device-info";
import { checkGracePeriod } from "@/lib/licensing/grace-period";
import { determineAccessLevel } from "@/lib/licensing/read-only-mode";
import { z } from "zod";

const registerDeviceSchema = z.object({
  action: z.enum(["register_device", "deregister_device", "renew_request"]),
});

// GET /api/licensing/licence - Get current user's licence
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      );
    }
    
    requireAuth(user);

    // Fetch or create licence for tenant
    let licence = await prisma.license.findUnique({
      where: { tenantId: user.tenantId },
    });

    // If no licence exists, create one (for initial setup)
    if (!licence) {
      const licenceKey = generateLicenceKey();
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year from now

      licence = await prisma.license.create({
        data: {
          tenantId: user.tenantId,
          subscriberId: user.tenantId, // Using tenantId as subscriberId
          licenceKey,
          status: "active",
          expiresAt,
          maxDevices: 1,
          ipPolicy: "single",
        },
      });
    }

    // Sync registeredIp with allowedIp if needed (for compatibility)
    if (licence.registeredIp && !licence.allowedIp) {
      await prisma.license.update({
        where: { id: licence.id },
        data: { allowedIp: licence.registeredIp },
      });
      licence.allowedIp = licence.registeredIp;
    }

    // Check grace period
    const graceStatus = await checkGracePeriod(licence);
    const accessLevel = determineAccessLevel(
      licence.status,
      graceStatus.expired,
      graceStatus.inGrace,
      graceStatus.daysInGrace
    );

    const daysRemaining = getDaysRemaining(licence.expiresAt);
    const maskedKey = maskLicenceKey(licence.licenceKey);

    // Get device registration for OS/Browser info
    const deviceRegistration = await prisma.deviceRegistration.findFirst({
      where: {
        tenantId: user.tenantId,
        revokedAt: null,
      },
      orderBy: {
        registeredAt: "desc",
      },
    });

    // Determine status display (expiring soon if <30 days)
    let statusDisplay: string = licence.status;
    if (licence.status === "active" && daysRemaining !== null && daysRemaining < 30 && daysRemaining > 0) {
      statusDisplay = "expiring_soon"; // Display-only status, not part of LicenseStatus enum
    }

    return NextResponse.json({
      licence: {
        licence_id: licence.id,
        subscriber_id: licence.subscriberId || licence.tenantId,
        licence_key: maskedKey,
        licence_key_full: licence.licenceKey, // For display in admin view only
        registered_device_fingerprint: licence.registeredDeviceFingerprint || null,
        registered_ip: licence.registeredIp || licence.allowedIp || null,
        expires_at: licence.expiresAt,
        status: licence.status,
        status_display: statusDisplay,
        renewal_code: licence.renewalCode || null,
        days_remaining: daysRemaining,
        in_grace_period: graceStatus.inGrace,
        grace_until: graceStatus.graceUntil,
        days_in_grace: graceStatus.daysInGrace,
        access_level: accessLevel.accessLevel,
        last_validated_at: licence.lastValidatedAt,
        validation_count: licence.validationCount || 0,
        violation_count: licence.violationCount || 0,
        last_violation_at: licence.lastViolationAt,
        admin_notes: licence.adminNotes || null,
        payment_reference_id: licence.paymentReferenceId || null,
        renewal_requested_at: licence.renewalRequestedAt,
        licence_type: "1 PC / 1 IP / Annual",
        created_at: licence.createdAt,
        updated_at: licence.updatedAt,
        device_info: deviceRegistration ? {
          operating_system: deviceRegistration.operatingSystem,
          browser: deviceRegistration.browser,
          registered_at: deviceRegistration.registeredAt,
        } : null,
      },
    });
  } catch (error: any) {
    console.error("Licence fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch licence", message: error.message },
      { status: error.status || 500 }
    );
  }
}

// POST /api/licensing/licence - Register device, deregister, etc.
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await request.json();
    const { action } = registerDeviceSchema.parse(body);

    const licence = await prisma.license.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!licence) {
      return NextResponse.json(
        { error: "Licence not found" },
        { status: 404 }
      );
    }

    const userAgent = request.headers.get("user-agent") || "";
    const currentIP = extractClientIP(request);
    const deviceFingerprint = generateDeviceFingerprintFromHeaders(userAgent, request.headers);
    
    // Extract device info (OS, Browser)
    const deviceInfo = extractDeviceInfo(userAgent);

    if (action === "register_device") {
      // Check grace period - allow registration during grace
      const graceStatus = await checkGracePeriod(licence);
      const accessLevel = determineAccessLevel(
        licence.status,
        graceStatus.expired,
        graceStatus.inGrace
      );

      // Only allow registration if licence is active or in grace period (read-only)
      const canRegister = licence.status === "active" || 
                         (licence.status === "expired" && graceStatus.inGrace) ||
                         accessLevel.accessLevel === "read_only";
      
      if (!canRegister && licence.status !== "pending_renewal") {
        return NextResponse.json(
          { error: `Cannot register device. Licence status: ${licence.status}. Please renew your licence first.` },
          { status: 403 }
        );
      }

      if (licence.registeredDeviceFingerprint && licence.registeredDeviceFingerprint !== deviceFingerprint) {
        return NextResponse.json(
          { error: "A different device is already registered. Please deregister the existing device first." },
          { status: 403 }
        );
      }

      // Register device with OS/Browser info
      const updatedLicence = await prisma.license.update({
        where: { id: licence.id },
        data: {
          registeredDeviceFingerprint: deviceFingerprint,
          registeredIp: currentIP,
          allowedIp: currentIP, // Sync for compatibility
          status: licence.status === "expired" && graceStatus.inGrace ? "expired" : "active",
        },
      });

      // Also update device registration if exists
      const existingDevice = await prisma.deviceRegistration.findFirst({
        where: {
          tenantId: user.tenantId,
          revokedAt: null,
        },
      });

      if (existingDevice) {
        await prisma.deviceRegistration.update({
          where: { id: existingDevice.id },
          data: {
            operatingSystem: deviceInfo.operatingSystem,
            browser: deviceInfo.browser,
            userAgent: deviceInfo.userAgent,
            registeredIp: currentIP,
            lastSeenAt: new Date(),
          },
        });
      } else {
        // Create device registration record
        await prisma.deviceRegistration.create({
          data: {
            tenantId: user.tenantId,
            userId: user.userId,
            deviceId: await getOrCreateDeviceId(),
            deviceType: "web",
            operatingSystem: deviceInfo.operatingSystem,
            browser: deviceInfo.browser,
            userAgent: deviceInfo.userAgent,
            registeredIp: currentIP,
            deviceLabel: "Primary Device",
          },
        });
      }

      // Log action
      await prisma.licenseAuditLog.create({
        data: {
          tenantId: user.tenantId,
          licenceId: licence.id,
          actorUserId: user.userId,
          action: "register_device",
          notes: `Device registered from IP: ${currentIP}`,
          meta: {
            deviceFingerprint,
            ipAddress: currentIP,
            userAgent,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: "Device registered successfully",
        licence: {
          registered_device_fingerprint: updatedLicence.registeredDeviceFingerprint,
          registered_ip: updatedLicence.registeredIp,
        },
      });
    }

    if (action === "deregister_device") {
      // Only allow if licence is active or expired (not suspended)
      if (licence.status === "suspended") {
        return NextResponse.json(
          { error: "Cannot deregister device. Licence is suspended." },
          { status: 403 }
        );
      }

      // Set status to pending_renewal and clear device/IP
      const updatedLicence = await prisma.license.update({
        where: { id: licence.id },
        data: {
          registeredDeviceFingerprint: null,
          registeredIp: null,
          allowedIp: null,
          status: licence.status === "expired" ? "expired" : "pending_renewal",
        },
      });

      // Log action
      await prisma.licenseAuditLog.create({
        data: {
          tenantId: user.tenantId,
          licenceId: licence.id,
          actorUserId: user.userId,
          action: "deregister_device",
          notes: "Device deregistered - requires admin approval",
          meta: {
            previousDeviceFingerprint: licence.registeredDeviceFingerprint,
            previousIp: licence.registeredIp,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: "Device deregistered. Status set to pending renewal. Please contact admin.",
        licence: {
          status: updatedLicence.status,
        },
      });
    }

    if (action === "renew_request") {
      // This action is informational - actual renewal is done by admin
      return NextResponse.json({
        message: "Renewal code generated. Please contact admin with this code.",
        renewal_code: licence.renewalCode || null,
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Licence action error:", error);
    return NextResponse.json(
      { error: "Failed to process licence action", message: error.message },
      { status: error.status || 500 }
    );
  }
}
