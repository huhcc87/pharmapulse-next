/**
 * Analytics Step-Up Authentication
 * 
 * Requires extra verification to access Analytics Dashboard.
 * Even if session is stolen, Analytics requires step-up.
 */

import { prisma } from "@/lib/prisma";
import { generateAccessToken } from "@/lib/auth/jwt";
import crypto from "crypto";

const ANALYTICS_UNLOCK_DURATION_HOURS = 24;
const ANALYTICS_UNLOCK_DURATION_SECONDS = ANALYTICS_UNLOCK_DURATION_HOURS * 60 * 60;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

export interface StepUpChallenge {
  challengeId: string;
  method: 'email_otp' | 'totp' | 'analytics_pin';
  expiresAt: Date;
}

/**
 * Check if step-up is required for analytics
 */
export async function isAnalyticsStepUpRequired(
  tenantId: string,
  userId: string,
  userRole: string,
  sessionAgeHours: number,
  isNewDevice: boolean,
  ipChanged: boolean
): Promise<boolean> {
  // Owner doesn't need step-up if session is fresh (< 8 hours)
  if (userRole === 'OWNER' || userRole === 'owner') {
    if (sessionAgeHours < 8 && !isNewDevice && !ipChanged) {
      return false;
    }
  }

  // Always require step-up if:
  // - Not owner
  // - Session > 8 hours
  // - New device
  // - IP changed
  return true;
}

/**
 * Start step-up challenge for analytics
 */
export async function startAnalyticsStepUp(
  tenantId: string,
  userId: string,
  method: 'email_otp' | 'totp' | 'analytics_pin',
  ipAddress?: string,
  userAgent?: string,
  deviceId?: string
): Promise<StepUpChallenge> {
  // Check if locked
  const existing = await prisma.stepUpSession.findFirst({
    where: {
      tenantId,
      userId,
      purpose: 'analytics_unlock',
      lockedUntil: {
        gt: new Date(),
      },
    },
  });

  if (existing) {
    throw new Error(`Step-up authentication is locked. Try again after ${existing.lockedUntil}`);
  }

  const challengeId = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Challenge expires in 10 minutes

  await prisma.stepUpSession.create({
    data: {
      tenantId,
      userId,
      method,
      purpose: 'analytics_unlock',
      challengeId,
      expiresAt,
      ipAddress,
      userAgent,
      deviceId,
    },
  });

  // TODO: Send OTP via email if method is email_otp
  // TODO: Generate TOTP if method is totp
  // TODO: For analytics_pin, owner must set PIN in settings

  return {
    challengeId,
    method,
    expiresAt,
  };
}

/**
 * Verify step-up challenge and issue analytics unlock token
 */
export async function verifyAnalyticsStepUp(
  challengeId: string,
  code: string, // OTP, TOTP code, or PIN
  tenantId: string,
  userId: string
): Promise<{ success: boolean; token?: string; expiresAt?: Date }> {
  const session = await prisma.stepUpSession.findUnique({
    where: { challengeId },
  });

  if (!session) {
    throw new Error('Invalid challenge ID');
  }

  if (session.tenantId !== tenantId || session.userId !== userId) {
    throw new Error('Challenge mismatch');
  }

  if (session.expiresAt < new Date()) {
    throw new Error('Challenge expired');
  }

  if (session.lockedUntil && session.lockedUntil > new Date()) {
    throw new Error(`Too many failed attempts. Locked until ${session.lockedUntil}`);
  }

  // Verify code based on method
  let isValid = false;

  if (session.method === 'email_otp') {
    // TODO: Verify email OTP (store OTP in session or separate table)
    // For now, accept any 6-digit code
    isValid = /^\d{6}$/.test(code);
  } else if (session.method === 'totp') {
    // TODO: Verify TOTP using speakeasy
    isValid = /^\d{6}$/.test(code);
  } else if (session.method === 'analytics_pin') {
    // TODO: Get owner-set PIN from settings and verify
    // For now, accept any 4-6 digit code
    isValid = /^\d{4,6}$/.test(code);
  }

  if (!isValid) {
    // Increment failed attempts
    const failedAttempts = session.failedAttempts + 1;
    let lockedUntil: Date | null = null;

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
    }

    await prisma.stepUpSession.update({
      where: { id: session.id },
      data: {
        failedAttempts,
        lockedUntil,
      },
    });

    return { success: false };
  }

  // Generate analytics unlock token
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + ANALYTICS_UNLOCK_DURATION_SECONDS);

  const token = generateAccessToken({
    userId,
    tenantId,
    email: `user-${userId}@pharmapulse.com`, // Adapt to your User model
    role: 'user',
    sessionId: session.id,
  });

  // Update session with token
  await prisma.stepUpSession.update({
    where: { id: session.id },
    data: {
      token,
      verifiedAt: new Date(),
      expiresAt,
      failedAttempts: 0,
      lockedUntil: null,
    },
  });

  return {
    success: true,
    token,
    expiresAt,
  };
}

/**
 * Verify analytics unlock token
 */
export async function verifyAnalyticsUnlockToken(
  token: string,
  tenantId: string,
  userId: string
): Promise<boolean> {
  const session = await prisma.stepUpSession.findFirst({
    where: {
      tenantId,
      userId,
      purpose: 'analytics_unlock',
      token,
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  return session !== null;
}

/**
 * Get valid analytics unlock token for user
 */
export async function getAnalyticsUnlockToken(
  tenantId: string,
  userId: string
): Promise<string | null> {
  const session = await prisma.stepUpSession.findFirst({
    where: {
      tenantId,
      userId,
      purpose: 'analytics_unlock',
      token: {
        not: null,
      },
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      verifiedAt: 'desc',
    },
  });

  return session?.token || null;
}
