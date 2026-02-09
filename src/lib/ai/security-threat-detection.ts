// src/lib/ai/security-threat-detection.ts
// AI Threat Detection & Anomaly Detection
// Real-time login anomaly detection, behavioral biometrics, suspicious activity scoring

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface ThreatDetectionResult {
  threatType:
    | "LOGIN_ANOMALY"
    | "BEHAVIORAL_ANOMALY"
    | "SUSPICIOUS_ACTIVITY"
    | "DEVICE_ANOMALY";
  riskScore: number; // 0-100
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  isLoginAnomaly: boolean;
  isBehavioralAnomaly: boolean;
  isTimeAnomaly: boolean;
  isLocationAnomaly: boolean;
  autoBlocked: boolean;
  reasoning?: string;
}

/**
 * Prisma Decimal -> number (safe-ish)
 * Handles: Decimal, string, number, null/undefined
 */
function toNumber(value: unknown, fallback = 0): number {
  if (value == null) return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  // Prisma.Decimal instance
  if (value instanceof Prisma.Decimal) {
    const n = value.toNumber();
    return Number.isFinite(n) ? n : fallback;
  }
  // Some Decimal-like objects have toNumber()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maybe = value as any;
  if (typeof maybe?.toNumber === "function") {
    const n = maybe.toNumber();
    return typeof n === "number" && Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/**
 * Detect security threats using AI/ML
 * Analyzes login patterns, behavior, timing, location
 */
export async function detectSecurityThreat(
  userId: string | null,
  tenantId: string,
  ipAddress: string | null,
  deviceId: string | null,
  userAgent: string | null,
  location?: string
): Promise<ThreatDetectionResult> {
  try {
    const result: ThreatDetectionResult = {
      threatType: "SUSPICIOUS_ACTIVITY",
      riskScore: 0,
      severity: "LOW",
      isLoginAnomaly: false,
      isBehavioralAnomaly: false,
      isTimeAnomaly: false,
      isLocationAnomaly: false,
      autoBlocked: false,
    };

    // 1) Login Anomaly Detection
    if (userId) {
      const loginAnomaly = await detectLoginAnomaly(userId, tenantId, ipAddress, deviceId);
      result.isLoginAnomaly = loginAnomaly.isAnomaly;
      if (loginAnomaly.isAnomaly) {
        result.riskScore += loginAnomaly.riskScore;
        result.threatType = "LOGIN_ANOMALY";
        result.reasoning = loginAnomaly.reason;
      }
    }

    // 2) Time Anomaly Detection
    const timeAnomaly = detectTimeAnomaly();
    result.isTimeAnomaly = timeAnomaly.isAnomaly;
    if (timeAnomaly.isAnomaly) {
      result.riskScore += 20;
      result.reasoning = (result.reasoning || "") + ` ${timeAnomaly.reason}`;
    }

    // 3) Location Anomaly Detection
    if (location && userId) {
      const locationAnomaly = await detectLocationAnomaly(userId, tenantId, location);
      result.isLocationAnomaly = locationAnomaly.isAnomaly;
      if (locationAnomaly.isAnomaly) {
        result.riskScore += 30;
        result.reasoning = (result.reasoning || "") + ` ${locationAnomaly.reason}`;
      }
    }

    // 4) Device Anomaly Detection
    if (deviceId && userId) {
      const deviceAnomaly = await detectDeviceAnomaly(userId, tenantId, deviceId);
      if (deviceAnomaly.isAnomaly) {
        result.riskScore += 25;
        result.threatType = "DEVICE_ANOMALY";
        result.reasoning = (result.reasoning || "") + ` ${deviceAnomaly.reason}`;
      }
    }

    // 5) Behavioral Anomaly Detection (future)
    // (needs client-side telemetry)

    // Determine severity
    if (result.riskScore >= 80) {
      result.severity = "CRITICAL";
      result.autoBlocked = true;
    } else if (result.riskScore >= 60) {
      result.severity = "HIGH";
      result.autoBlocked = true;
    } else if (result.riskScore >= 40) {
      result.severity = "MEDIUM";
    }

    return result;
  } catch (error: any) {
    console.error("Threat detection error:", error);
    throw error;
  }
}

/**
 * Detect login anomalies
 * Checks: unusual IP, device, rapid frequency
 */
async function detectLoginAnomaly(
  userId: string,
  tenantId: string,
  ipAddress: string | null,
  deviceId: string | null
): Promise<{
  isAnomaly: boolean;
  riskScore: number;
  reason?: string;
}> {
  const recentLogins = await prisma.securityEvent.findMany({
    where: {
      tenantId,
      userId,
      eventType: "LOGIN_SUCCESS",
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (recentLogins.length === 0) return { isAnomaly: false, riskScore: 0 };

  if (ipAddress) {
    const knownIPs = new Set(recentLogins.map((e) => e.ipAddress).filter(Boolean) as string[]);
    if (!knownIPs.has(ipAddress)) {
      return { isAnomaly: true, riskScore: 40, reason: "Login from new IP address" };
    }
  }

  if (deviceId) {
    const knownDevices = new Set(
      recentLogins.map((e) => e.deviceId).filter(Boolean) as string[]
    );
    if (!knownDevices.has(deviceId)) {
      return { isAnomaly: true, riskScore: 50, reason: "Login from new device" };
    }
  }

  if (recentLogins.length >= 2) {
    const lastTwo = recentLogins.slice(0, 2);
    const timeDiff = lastTwo[0].createdAt.getTime() - lastTwo[1].createdAt.getTime();
    if (timeDiff < 60_000) {
      return { isAnomaly: true, riskScore: 30, reason: "Rapid successive logins detected" };
    }
  }

  return { isAnomaly: false, riskScore: 0 };
}

/**
 * Detect time anomalies (outside normal hours)
 */
function detectTimeAnomaly(): { isAnomaly: boolean; reason?: string } {
  const hour = new Date().getHours();
  // Normal hours: 8 AM - 10 PM
  if (hour < 8 || hour > 22) {
    return { isAnomaly: true, reason: `Login at unusual time: ${hour}:00` };
  }
  return { isAnomaly: false };
}

/**
 * Detect location anomalies
 */
async function detectLocationAnomaly(
  userId: string,
  tenantId: string,
  currentLocation: string
): Promise<{ isAnomaly: boolean; reason?: string }> {
  const recent = await prisma.aISecurityThreat.findMany({
    where: {
      tenantId,
      userId,
      location: { not: null },
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    select: { location: true },
    take: 10,
  });

  if (recent.length === 0) return { isAnomaly: false };

  const knownLocations = new Set(recent.map((t) => t.location).filter(Boolean) as string[]);
  if (!knownLocations.has(currentLocation)) {
    return { isAnomaly: true, reason: `Login from new location: ${currentLocation}` };
  }

  return { isAnomaly: false };
}

/**
 * Detect device anomalies
 *
 * FIX:
 * trustScore is Prisma Decimal -> convert to number before comparing.
 */
async function detectDeviceAnomaly(
  userId: string,
  tenantId: string,
  deviceId: string
): Promise<{ isAnomaly: boolean; reason?: string }> {
  const fingerprint = await prisma.aIDeviceFingerprint.findFirst({
    where: { tenantId, deviceId },
    orderBy: { createdAt: "desc" },
  });

  if (!fingerprint) return { isAnomaly: false };

  const trustScoreNum = toNumber((fingerprint as any).trustScore, 0);

  if (trustScoreNum < 50) {
    return {
      isAnomaly: true,
      reason: `Device has low trust score: ${trustScoreNum}`,
    };
  }

  return { isAnomaly: false };
}
