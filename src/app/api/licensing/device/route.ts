/**
 * Device Management API
 * 
 * Endpoints:
 * - GET: Get current registered device
 * - POST: Register/revoke device (Owner only)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { extractClientIP } from "@/lib/licensing/ip-extraction";
import { getOrCreateDeviceId, generateDeviceFingerprint } from "@/lib/licensing/device-id";
import { extractDeviceInfo } from "@/lib/licensing/device-info";
import { z } from "zod";

const registerDeviceSchema = z.object({
  action: z.enum(["register", "revoke"]),
  deviceLabel: z.string().optional(),
});

// GET /api/licensing/device - Get current device status
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { 
          error: "UNAUTHORIZED",
          message: "Authentication required. Please ensure you are logged in.",
          help: "In development, cookies are auto-set. If this persists, check browser console."
        },
        { status: 401 }
      );
    }
    
    requireAuth(user);

    const license = await prisma.license.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!license) {
      return NextResponse.json(
        { error: "License not found" },
        { status: 404 }
      );
    }

    const activeDevice = await prisma.deviceRegistration.findFirst({
      where: {
        tenantId: user.tenantId,
        revokedAt: null,
      },
      orderBy: {
        registeredAt: "desc",
      },
    });

    const currentDeviceId = await getOrCreateDeviceId();
    const currentIP = extractClientIP(request);

    return NextResponse.json({
      license: {
        status: license.status,
        allowedIp: license.allowedIp,
        maxDevices: license.maxDevices,
      },
      activeDevice: activeDevice
        ? {
            id: activeDevice.id,
            deviceId: activeDevice.deviceId,
            deviceLabel: activeDevice.deviceLabel,
            deviceType: activeDevice.deviceType,
            operatingSystem: activeDevice.operatingSystem,
            browser: activeDevice.browser,
            registeredAt: activeDevice.registeredAt,
            lastSeenAt: activeDevice.lastSeenAt,
            registeredIp: activeDevice.registeredIp,
            isCurrentDevice: activeDevice.deviceId === currentDeviceId,
          }
        : null,
      currentDevice: {
        deviceId: currentDeviceId,
        ip: currentIP,
      },
    });
  } catch (error: any) {
    console.error("Device status error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get device status" },
      { status: error.status || 500 }
    );
  }
}

// POST /api/licensing/device - Register or revoke device
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    // Only owner/admin can manage devices
    if (user.role !== "owner" && user.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only owner can manage devices" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, deviceLabel } = registerDeviceSchema.parse(body);

    const license = await prisma.license.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!license) {
      return NextResponse.json(
        { error: "License not found" },
        { status: 404 }
      );
    }

    if (license.status !== "active") {
      return NextResponse.json(
        { error: "License is not active" },
        { status: 403 }
      );
    }

    const currentDeviceId = await getOrCreateDeviceId();
    const currentIP = extractClientIP(request);
    const userAgent = request.headers.get("user-agent");

    if (action === "revoke") {
      // Revoke current device and register new one
      const activeDevice = await prisma.deviceRegistration.findFirst({
        where: {
          tenantId: user.tenantId,
          revokedAt: null,
        },
      });

      if (activeDevice) {
        // Revoke old device
        await prisma.deviceRegistration.update({
          where: { id: activeDevice.id },
          data: { revokedAt: new Date() },
        });

        // Log revocation
        await prisma.licenseAuditLog.create({
          data: {
            tenantId: user.tenantId,
            actorUserId: user.userId,
            action: "DEVICE_REVOKED",
            meta: {
              revokedDeviceId: activeDevice.deviceId,
              revokedDeviceLabel: activeDevice.deviceLabel,
              reason: "Owner revoked and registered new device",
            },
          },
        });
      }

      // Register new device
      const fingerprint = generateDeviceFingerprint(userAgent, request.headers);
      const deviceInfo = extractDeviceInfo(userAgent);
      const newDevice = await prisma.deviceRegistration.create({
        data: {
          tenantId: user.tenantId,
          userId: user.userId,
          deviceId: currentDeviceId,
          deviceType: "web",
          deviceLabel: deviceLabel || "Primary Device",
          registeredIp: currentIP,
          operatingSystem: deviceInfo.operatingSystem,
          browser: deviceInfo.browser,
          userAgent: deviceInfo.userAgent,
        },
      });

      // Log registration
      await prisma.licenseAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.userId,
          action: "DEVICE_REGISTERED",
          meta: {
            deviceId: newDevice.deviceId,
            deviceLabel: newDevice.deviceLabel,
            ip: currentIP,
            fingerprint,
            reason: "Owner registered new device",
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: "Device revoked and new device registered",
        device: {
          id: newDevice.id,
          deviceId: newDevice.deviceId,
          deviceLabel: newDevice.deviceLabel,
          registeredAt: newDevice.registeredAt,
        },
      });
    }

    // Register action (if no device exists)
    const existingDevice = await prisma.deviceRegistration.findFirst({
      where: {
        tenantId: user.tenantId,
        revokedAt: null,
      },
    });

    if (existingDevice) {
      return NextResponse.json(
        { error: "A device is already registered. Revoke it first to register a new one." },
        { status: 400 }
      );
    }

    // Register first device
    const fingerprint = generateDeviceFingerprint(userAgent, request.headers);
    const deviceInfo = extractDeviceInfo(userAgent);
    const newDevice = await prisma.deviceRegistration.create({
      data: {
        tenantId: user.tenantId,
        userId: user.userId,
        deviceId: currentDeviceId,
        deviceType: "web",
        deviceLabel: deviceLabel || "Primary Device",
        registeredIp: currentIP,
        operatingSystem: deviceInfo.operatingSystem,
        browser: deviceInfo.browser,
        userAgent: deviceInfo.userAgent,
      },
    });

    // Log registration
    await prisma.licenseAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.userId,
        action: "DEVICE_REGISTERED",
        meta: {
          deviceId: newDevice.deviceId,
          deviceLabel: newDevice.deviceLabel,
          ip: currentIP,
          fingerprint,
          reason: "Owner registered first device",
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Device registered successfully",
      device: {
        id: newDevice.id,
        deviceId: newDevice.deviceId,
        deviceLabel: newDevice.deviceLabel,
        registeredAt: newDevice.registeredAt,
      },
    });
  } catch (error: any) {
    console.error("Device management error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to manage device" },
      { status: error.status || 500 }
    );
  }
}
