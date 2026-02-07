/**
 * Step-up Authentication
 * 
 * Requires additional authentication (MFA or re-auth) for risky actions.
 * Step-up sessions expire after 10 minutes (configurable).
 */

import { prisma } from "@/lib/prisma";
import { StepUpMethod } from "@prisma/client";
import { extractClientIP } from "@/lib/licensing/ip-extraction";
import { NextRequest } from "next/server";

const STEP_UP_TIMEOUT_MINUTES = 10; // Default 10 minutes

/**
 * Create a step-up session after successful verification
 */
export async function createStepUpSession(
  tenantId: string,
  userId: string,
  method: StepUpMethod,
  request: NextRequest
): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + STEP_UP_TIMEOUT_MINUTES * 60 * 1000);
  const ipAddress = extractClientIP(request);
  const userAgent = request.headers.get("user-agent");

  const session = await prisma.stepUpSession.create({
    data: {
      tenantId,
      userId,
      method,
      verifiedAt: now,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  return session.id;
}

/**
 * Check if user has a valid step-up session
 * Returns true if valid session exists, false otherwise
 */
export async function hasValidStepUpSession(
  tenantId: string,
  userId: string
): Promise<boolean> {
  const now = new Date();

  const session = await prisma.stepUpSession.findFirst({
    where: {
      tenantId,
      userId,
      expiresAt: {
        gt: now, // Not expired
      },
    },
    orderBy: {
      verifiedAt: "desc",
    },
  });

  return !!session;
}

/**
 * Require step-up authentication
 * Throws error if no valid step-up session exists
 */
export async function requireStepUpAuth(
  tenantId: string,
  userId: string
): Promise<void> {
  const hasSession = await hasValidStepUpSession(tenantId, userId);

  if (!hasSession) {
    const err = new Error("Step-up authentication required");
    // @ts-ignore
    err.status = 403;
    // @ts-ignore
    err.code = "STEP_UP_REQUIRED";
    // @ts-ignore
    err.message = "This action requires additional authentication. Please verify your identity.";
    throw err;
  }
}

/**
 * Verify step-up authentication (password, TOTP, or magic link)
 * This is called after user provides credentials
 * 
 * For now, we'll implement password re-auth. MFA/TOTP can be added later.
 */
export async function verifyStepUpAuth(
  tenantId: string,
  userId: string,
  method: StepUpMethod,
  request: NextRequest
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  // TODO: Implement actual verification based on method
  // For password: verify password hash
  // For TOTP: verify TOTP code
  // For magic link: verify token

  // For now, we'll create a session if method is provided
  // In production, add actual verification logic here

  try {
    const sessionId = await createStepUpSession(tenantId, userId, method, request);
    return { success: true, sessionId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Clear expired step-up sessions (cleanup job)
 */
export async function cleanupExpiredStepUpSessions(): Promise<number> {
  const now = new Date();

  const result = await prisma.stepUpSession.deleteMany({
    where: {
      expiresAt: {
        lt: now,
      },
    },
  });

  return result.count;
}
