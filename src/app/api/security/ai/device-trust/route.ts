// AI Device Fingerprinting & Recognition API
// POST /api/security/ai/device-trust - Generate fingerprint
// GET /api/security/ai/device-trust - Get device trust score

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { generateDeviceFingerprint } from "@/lib/ai/device-fingerprinting";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { deviceId, fingerprintData } = body;

    if (!deviceId || !fingerprintData) {
      return NextResponse.json(
        { error: "deviceId and fingerprintData are required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";
    const userId = user.userId || null;

    // Generate fingerprint
    const fingerprint = await generateDeviceFingerprint(
      tenantId,
      userId,
      deviceId,
      fingerprintData
    );

    // Save fingerprint
    const savedFingerprint = await prisma.aIDeviceFingerprint.create({
      data: {
        tenantId,
        userId: userId || null,
        deviceId,
        browserFingerprint: fingerprint.browserFingerprint,
        hardwareFingerprint: fingerprint.hardwareFingerprint || null,
        networkFingerprint: fingerprint.networkFingerprint || null,
        trustScore: fingerprint.trustScore,
        trustLevel: fingerprint.trustLevel,
        browser: fingerprintData.browser || null,
        os: fingerprintData.os || null,
        platform: fingerprintData.platform || null,
        screenResolution: fingerprintData.screenResolution || null,
        timezone: fingerprintData.timezone || null,
        language: fingerprintData.language || null,
        similarDevices: fingerprint.similarDevices
          ? JSON.parse(JSON.stringify(fingerprint.similarDevices))
          : null,
        similarityScore: fingerprint.similarDevices && fingerprint.similarDevices.length > 0
          ? fingerprint.similarDevices[0].similarityScore
          : null,
        isSuspicious: fingerprint.isSuspicious,
        suspiciousReasons: fingerprint.suspiciousReasons
          ? JSON.parse(JSON.stringify(fingerprint.suspiciousReasons))
          : null,
      },
    });

    return NextResponse.json({
      success: true,
      fingerprint: {
        id: savedFingerprint.id,
        trustScore: fingerprint.trustScore,
        trustLevel: fingerprint.trustLevel,
        isSuspicious: fingerprint.isSuspicious,
        suspiciousReasons: fingerprint.suspiciousReasons,
        similarDevices: fingerprint.similarDevices,
      },
    });
  } catch (error: any) {
    console.error("Device fingerprinting API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/security/ai/device-trust - Get device trust score
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const deviceId = searchParams.get("deviceId");
    const trustLevel = searchParams.get("trustLevel");

    const where: any = { tenantId };
    if (deviceId) {
      where.deviceId = deviceId;
    }
    if (trustLevel) {
      where.trustLevel = trustLevel;
    }

    const fingerprints = await prisma.aIDeviceFingerprint.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    return NextResponse.json({
      fingerprints: fingerprints.map((f) => ({
        id: f.id,
        deviceId: f.deviceId,
        trustScore: f.trustScore,
        trustLevel: f.trustLevel,
        isSuspicious: f.isSuspicious,
        browser: f.browser,
        os: f.os,
        platform: f.platform,
        createdAt: f.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Get device fingerprints API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
