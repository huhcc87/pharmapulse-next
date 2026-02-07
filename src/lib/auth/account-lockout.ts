/**
 * Account Lockout Management
 * 
 * Prevents brute force attacks by locking accounts after failed login attempts.
 */

import { prisma } from "@/lib/prisma";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

/**
 * Record a failed login attempt
 */
export async function recordFailedLogin(
  userId: string,
  tenantId: string,
  email: string,
  ipAddress?: string
): Promise<{
  isLocked: boolean;
  lockedUntil: Date | null;
  remainingAttempts: number;
}> {
  const lockout = await prisma.accountLockout.upsert({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
    create: {
      userId,
      tenantId,
      email,
      failedAttempts: 1,
      lastFailedAt: new Date(),
      lastFailedIp: ipAddress,
    },
    update: {
      failedAttempts: {
        increment: 1,
      },
      lastFailedAt: new Date(),
      lastFailedIp: ipAddress,
    },
  });

  // Check if should lock
  if (lockout.failedAttempts >= MAX_FAILED_ATTEMPTS && !lockout.lockedUntil) {
    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);

    await prisma.accountLockout.update({
      where: { id: lockout.id },
      data: { lockedUntil },
    });

    return {
      isLocked: true,
      lockedUntil,
      remainingAttempts: 0,
    };
  }

  // Check if already locked
  if (lockout.lockedUntil && lockout.lockedUntil > new Date()) {
    return {
      isLocked: true,
      lockedUntil: lockout.lockedUntil,
      remainingAttempts: 0,
    };
  }

  // Clear lock if expired
  if (lockout.lockedUntil && lockout.lockedUntil <= new Date()) {
    await prisma.accountLockout.update({
      where: { id: lockout.id },
      data: {
        lockedUntil: null,
        failedAttempts: 0,
      },
    });
  }

  return {
    isLocked: false,
    lockedUntil: lockout.lockedUntil,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - lockout.failedAttempts),
  };
}

/**
 * Clear failed attempts on successful login
 */
export async function clearFailedAttempts(
  userId: string,
  tenantId: string
): Promise<void> {
  await prisma.accountLockout.updateMany({
    where: {
      userId,
      tenantId,
    },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
}

/**
 * Check if account is locked
 */
export async function isAccountLocked(
  userId: string,
  tenantId: string
): Promise<{ locked: boolean; lockedUntil: Date | null }> {
  const lockout = await prisma.accountLockout.findUnique({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
  });

  if (!lockout || !lockout.lockedUntil) {
    return { locked: false, lockedUntil: null };
  }

  // Check if lock expired
  if (lockout.lockedUntil <= new Date()) {
    // Clear expired lock
    await prisma.accountLockout.update({
      where: { id: lockout.id },
      data: {
        lockedUntil: null,
        failedAttempts: 0,
      },
    });
    return { locked: false, lockedUntil: null };
  }

  return { locked: true, lockedUntil: lockout.lockedUntil };
}

/**
 * Manually lock an account (admin action)
 */
export async function lockAccount(
  userId: string,
  tenantId: string,
  lockedBy: string,
  reason?: string
): Promise<void> {
  const lockedUntil = new Date();
  lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);

  await prisma.accountLockout.upsert({
    where: {
      userId_tenantId: {
        userId,
        tenantId,
      },
    },
    create: {
      userId,
      tenantId,
      email: "", // Will be updated if user exists
      failedAttempts: MAX_FAILED_ATTEMPTS,
      lockedUntil,
    },
    update: {
      lockedUntil,
      failedAttempts: MAX_FAILED_ATTEMPTS,
    },
  });
}

/**
 * Manually unlock an account (admin action)
 */
export async function unlockAccount(
  userId: string,
  tenantId: string
): Promise<void> {
  await prisma.accountLockout.updateMany({
    where: {
      userId,
      tenantId,
    },
    data: {
      lockedUntil: null,
      failedAttempts: 0,
    },
  });
}
