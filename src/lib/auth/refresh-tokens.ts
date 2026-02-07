/**
 * Refresh Token Management
 * 
 * Server-side refresh token storage, validation, and rotation.
 */

import { prisma } from "@/lib/prisma";
import { generateRefreshToken, hashRefreshToken } from "./jwt";
import { getTokenExpiration } from "./jwt";

const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const REFRESH_TOKEN_EXPIRY_SECONDS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60;

export interface RefreshTokenData {
  userId: string;
  tenantId: string;
  deviceId?: string;
  deviceType?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create a new refresh token
 */
export async function createRefreshToken(data: RefreshTokenData): Promise<{
  token: string;
  tokenId: string;
  expiresAt: Date;
}> {
  const { token, hash } = generateRefreshToken();
  const expiresAt = getTokenExpiration(REFRESH_TOKEN_EXPIRY_SECONDS);

  const refreshToken = await prisma.refreshToken.create({
    data: {
      userId: data.userId,
      tenantId: data.tenantId,
      tokenHash: hash,
      deviceId: data.deviceId,
      deviceType: data.deviceType,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      expiresAt,
    },
  });

  return {
    token, // Return plain token (only sent once)
    tokenId: refreshToken.id,
    expiresAt,
  };
}

/**
 * Validate and rotate refresh token
 * Returns new token pair if valid, null if invalid
 */
export async function validateAndRotateRefreshToken(
  token: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{
  userId: string;
  tenantId: string;
  deviceId?: string;
  deviceType?: string;
  newRefreshToken: string;
  newRefreshTokenId: string;
} | null> {
  const tokenHash = hashRefreshToken(token);

  // Find token
  const refreshToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      tenant: true,
    },
  });

  if (!refreshToken) {
    return null; // Token not found
  }

  // Check if revoked
  if (refreshToken.revokedAt) {
    return null; // Token revoked
  }

  // Check if expired
  if (refreshToken.expiresAt < new Date()) {
    // Revoke expired token
    await prisma.refreshToken.update({
      where: { id: refreshToken.id },
      data: { revokedAt: new Date(), revokedReason: "Expired" },
    });
    return null;
  }

  // Rotate token (revoke old, create new)
  const { token: newToken, hash: newHash } = generateRefreshToken();
  const expiresAt = getTokenExpiration(REFRESH_TOKEN_EXPIRY_SECONDS);

  // Use transaction to ensure atomicity
  await prisma.$transaction(async (tx) => {
    // Revoke old token
    await tx.refreshToken.update({
      where: { id: refreshToken.id },
      data: {
        revokedAt: new Date(),
        revokedReason: "Rotated",
        lastUsedAt: new Date(),
      },
    });

    // Create new token
    await tx.refreshToken.create({
      data: {
        userId: refreshToken.userId,
        tenantId: refreshToken.tenantId,
        tokenHash: newHash,
        deviceId: refreshToken.deviceId,
        deviceType: refreshToken.deviceType,
        ipAddress: ipAddress || refreshToken.ipAddress,
        userAgent: userAgent || refreshToken.userAgent,
        expiresAt,
      },
    });
  });

  return {
    userId: refreshToken.userId,
    tenantId: refreshToken.tenantId,
    deviceId: refreshToken.deviceId || undefined,
    deviceType: refreshToken.deviceType || undefined,
    newRefreshToken: newToken,
    newRefreshTokenId: refreshToken.id, // Return old ID for session update
  };
}

/**
 * Revoke refresh token
 */
export async function revokeRefreshToken(
  tokenHash: string,
  revokedBy?: string,
  reason?: string
): Promise<boolean> {
  try {
    await prisma.refreshToken.update({
      where: { tokenHash },
      data: {
        revokedAt: new Date(),
        revokedBy,
        revokedReason: reason || "Manual revocation",
      },
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserTokens(
  userId: string,
  tenantId: string,
  revokedBy?: string,
  reason?: string
): Promise<number> {
  const result = await prisma.refreshToken.updateMany({
    where: {
      userId,
      tenantId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokedBy,
      revokedReason: reason || "Bulk revocation",
    },
  });

  return result.count;
}

/**
 * Clean up expired tokens (run periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}
