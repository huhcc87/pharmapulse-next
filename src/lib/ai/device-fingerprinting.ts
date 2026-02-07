// AI Device Fingerprinting & Recognition
// Advanced device fingerprinting, trust scoring, suspicious device detection

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface DeviceFingerprintResult {
  browserFingerprint: string;
  hardwareFingerprint?: string;
  networkFingerprint?: string;
  trustScore: number; // 0-100
  trustLevel: "TRUSTED" | "SUSPICIOUS" | "UNTRUSTED";
  isSuspicious: boolean;
  suspiciousReasons?: string[];
  similarDevices?: Array<{
    deviceId: string;
    similarityScore: number;
  }>;
}

/**
 * Generate device fingerprint
 */
export async function generateDeviceFingerprint(
  tenantId: string,
  userId: string | null,
  deviceId: string,
  fingerprintData: {
    browser?: string;
    os?: string;
    platform?: string;
    screenResolution?: string;
    timezone?: string;
    language?: string;
    canvasHash?: string;
    webglHash?: string;
    audioHash?: string;
  }
): Promise<DeviceFingerprintResult> {
  try {
    // Generate browser fingerprint (combine canvas, webgl, audio)
    const browserFingerprint = generateBrowserFingerprint(
      fingerprintData.canvasHash,
      fingerprintData.webglHash,
      fingerprintData.audioHash
    );

    // Generate hardware fingerprint
    const hardwareFingerprint = generateHardwareFingerprint(
      fingerprintData.screenResolution,
      fingerprintData.platform
    );

    // Generate network fingerprint
    const networkFingerprint = generateNetworkFingerprint(
      fingerprintData.timezone,
      fingerprintData.language
    );

    // Calculate trust score
    const trustScore = calculateTrustScore(
      browserFingerprint,
      hardwareFingerprint,
      networkFingerprint,
      tenantId,
      deviceId
    );

    // Check for similar devices
    const similarDevices = await findSimilarDevices(
      tenantId,
      browserFingerprint,
      hardwareFingerprint
    );

    // Determine trust level
    let trustLevel: "TRUSTED" | "SUSPICIOUS" | "UNTRUSTED" = "TRUSTED";
    const suspiciousReasons: string[] = [];

    if (trustScore < 50) {
      trustLevel = "UNTRUSTED";
      suspiciousReasons.push("Low trust score");
    } else if (trustScore < 70) {
      trustLevel = "SUSPICIOUS";
      suspiciousReasons.push("Moderate trust score");
    }

    // Check for device sharing (similar devices)
    if (similarDevices.length > 2) {
      trustLevel = "SUSPICIOUS";
      suspiciousReasons.push(`Found ${similarDevices.length} similar devices (possible device sharing)`);
    }

    // Check for inconsistent fingerprints
    if (!hardwareFingerprint || !networkFingerprint) {
      trustLevel = trustLevel === "UNTRUSTED" ? "UNTRUSTED" : "SUSPICIOUS";
      suspiciousReasons.push("Incomplete fingerprint data");
    }

    return {
      browserFingerprint,
      hardwareFingerprint,
      networkFingerprint,
      trustScore,
      trustLevel,
      isSuspicious: trustLevel !== "TRUSTED",
      suspiciousReasons: suspiciousReasons.length > 0 ? suspiciousReasons : undefined,
      similarDevices: similarDevices.length > 0 ? similarDevices : undefined,
    };
  } catch (error: any) {
    console.error("Device fingerprinting error:", error);
    throw error;
  }
}

function generateBrowserFingerprint(
  canvasHash?: string,
  webglHash?: string,
  audioHash?: string
): string {
  // Combine browser fingerprint components
  const components = [
    canvasHash || "unknown",
    webglHash || "unknown",
    audioHash || "unknown",
  ];
  return components.join("|");
}

function generateHardwareFingerprint(
  screenResolution?: string,
  platform?: string
): string | undefined {
  if (!screenResolution && !platform) {
    return undefined;
  }
  return `${screenResolution || "unknown"}|${platform || "unknown"}`;
}

function generateNetworkFingerprint(
  timezone?: string,
  language?: string
): string | undefined {
  if (!timezone && !language) {
    return undefined;
  }
  return `${timezone || "unknown"}|${language || "unknown"}`;
}

function calculateTrustScore(
  browserFingerprint: string,
  hardwareFingerprint?: string,
  networkFingerprint?: string,
  tenantId?: string,
  deviceId?: string
): number {
  let score = 100;

  // Deduct for missing components
  if (!hardwareFingerprint) {
    score -= 20;
  }
  if (!networkFingerprint) {
    score -= 15;
  }

  // Check if fingerprint is too generic
  if (browserFingerprint.includes("unknown")) {
    score -= 30;
  }

  return Math.max(0, Math.min(100, score));
}

async function findSimilarDevices(
  tenantId: string,
  browserFingerprint: string,
  hardwareFingerprint?: string
): Promise<Array<{ deviceId: string; similarityScore: number }>> {
  // Get existing fingerprints
  const existingFingerprints = await prisma.aIDeviceFingerprint.findMany({
    where: {
      tenantId,
      browserFingerprint: {
        not: browserFingerprint, // Exclude current device
      },
    },
    select: {
      deviceId: true,
      browserFingerprint: true,
      hardwareFingerprint: true,
    },
    take: 100,
  });

  const similar: Array<{ deviceId: string; similarityScore: number }> = [];

  for (const existing of existingFingerprints) {
    let similarity = 0;

    // Compare browser fingerprints
    if (existing.browserFingerprint === browserFingerprint) {
      similarity += 50;
    } else {
      // Partial match
      const currentParts = browserFingerprint.split("|");
      const existingParts = existing.browserFingerprint.split("|");
      const matches = currentParts.filter((p, i) => p === existingParts[i]).length;
      similarity += (matches / currentParts.length) * 50;
    }

    // Compare hardware fingerprints
    if (hardwareFingerprint && existing.hardwareFingerprint) {
      if (existing.hardwareFingerprint === hardwareFingerprint) {
        similarity += 30;
      }
    }

    if (similarity >= 60) {
      similar.push({
        deviceId: existing.deviceId,
        similarityScore: Math.round(similarity),
      });
    }
  }

  return similar.sort((a, b) => b.similarityScore - a.similarityScore);
}
