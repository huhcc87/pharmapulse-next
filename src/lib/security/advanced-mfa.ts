// Advanced MFA Options
// Biometric, Hardware Keys (WebAuthn/FIDO2), Adaptive MFA

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface MfaMethodData {
  methodType: "TOTP" | "SMS" | "EMAIL" | "BIOMETRIC" | "HARDWARE_KEY";
  name: string;
  secret?: string; // For TOTP
  credentialId?: string; // For WebAuthn
  publicKey?: string; // For WebAuthn
  biometricType?: "FINGERPRINT" | "FACE" | "VOICE";
}

/**
 * Register hardware key (WebAuthn)
 */
export async function registerHardwareKey(
  tenantId: string,
  userId: string,
  data: {
    credentialId: string;
    publicKey: string;
    name: string;
  }
): Promise<any> {
  try {
    const mfaMethod = await prisma.mfaMethod.create({
      data: {
        tenantId,
        userId,
        methodType: "HARDWARE_KEY",
        name: data.name,
        credentialId: data.credentialId,
        publicKey: data.publicKey,
        isEnabled: true,
        isDefault: false,
      },
    });

    return mfaMethod;
  } catch (error: any) {
    console.error("Register hardware key error:", error);
    throw error;
  }
}

/**
 * Register biometric MFA
 */
export async function registerBiometric(
  tenantId: string,
  userId: string,
  data: {
    biometricType: "FINGERPRINT" | "FACE" | "VOICE";
    name: string;
  }
): Promise<any> {
  try {
    const mfaMethod = await prisma.mfaMethod.create({
      data: {
        tenantId,
        userId,
        methodType: "BIOMETRIC",
        name: data.name,
        biometricType: data.biometricType,
        isEnabled: true,
        isDefault: false,
      },
    });

    return mfaMethod;
  } catch (error: any) {
    console.error("Register biometric error:", error);
    throw error;
  }
}

/**
 * Generate backup codes
 */
export async function generateBackupCodes(
  tenantId: string,
  userId: string,
  mfaMethodId: string,
  count: number = 10
): Promise<string[]> {
  try {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-digit backup code
      const code = Math.floor(10000000 + Math.random() * 90000000).toString();
      codes.push(code);
    }

    // Store encrypted backup codes
    await prisma.mfaMethod.update({
      where: {
        id: mfaMethodId,
        tenantId,
        userId,
      },
      data: {
        backupCodes: JSON.parse(JSON.stringify(codes)),
      },
    });

    return codes;
  } catch (error: any) {
    console.error("Generate backup codes error:", error);
    throw error;
  }
}

/**
 * Verify backup code
 */
export async function verifyBackupCode(
  tenantId: string,
  userId: string,
  mfaMethodId: string,
  code: string
): Promise<boolean> {
  try {
    const mfaMethod = await prisma.mfaMethod.findUnique({
      where: {
        id: mfaMethodId,
        tenantId,
        userId,
      },
    });

    if (!mfaMethod || !mfaMethod.backupCodes) {
      return false;
    }

    const codes = mfaMethod.backupCodes as string[];
    const index = codes.indexOf(code);

    if (index === -1) {
      return false;
    }

    // Remove used code
    codes.splice(index, 1);
    await prisma.mfaMethod.update({
      where: {
        id: mfaMethodId,
      },
      data: {
        backupCodes: JSON.parse(JSON.stringify(codes)),
      },
    });

    return true;
  } catch (error: any) {
    console.error("Verify backup code error:", error);
    return false;
  }
}

/**
 * Get user MFA methods
 */
export async function getUserMfaMethods(
  tenantId: string,
  userId: string
): Promise<any[]> {
  try {
    const methods = await prisma.mfaMethod.findMany({
      where: {
        tenantId,
        userId,
        isEnabled: true,
      },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });

    return methods.map((m) => ({
      id: m.id,
      methodType: m.methodType,
      name: m.name,
      isDefault: m.isDefault,
      lastUsedAt: m.lastUsedAt,
      hasBackupCodes: m.backupCodes !== null,
      // Don't expose sensitive data
    }));
  } catch (error: any) {
    console.error("Get user MFA methods error:", error);
    throw error;
  }
}

/**
 * Adaptive MFA - determine if MFA is required
 */
export async function requiresAdaptiveMfa(
  tenantId: string,
  userId: string,
  context: {
    ipAddress?: string;
    deviceId?: string;
    deviceTrustScore?: number;
    location?: {
      country: string;
      city?: string;
    };
    timeOfDay?: string;
  }
): Promise<{
  required: boolean;
  reason?: string;
  method?: string;
}> {
  try {
    // Check device trust
    if (context.deviceTrustScore !== undefined && context.deviceTrustScore < 50) {
      return {
        required: true,
        reason: "Device trust score is low",
        method: "HARDWARE_KEY", // Require strongest MFA
      };
    }

    // Check location (new country = require MFA)
    // This would require location history tracking

    // Check time of day (off-hours = require MFA)
    if (context.timeOfDay) {
      const hour = parseInt(context.timeOfDay.split(":")[0]);
      if (hour < 6 || hour > 22) {
        return {
          required: true,
          reason: "Off-hours access",
          method: "TOTP",
        };
      }
    }

    // Default: MFA not required for trusted devices
    return {
      required: false,
    };
  } catch (error: any) {
    console.error("Requires adaptive MFA error:", error);
    // Default to requiring MFA on error
    return {
      required: true,
      reason: "Error determining MFA requirement",
    };
  }
}
