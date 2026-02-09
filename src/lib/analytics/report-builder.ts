/**
 * Analytics Step-Up Authentication
 *
 * Requires extra verification to access Analytics Dashboard.
 * Even if session is stolen, Analytics requires step-up.
 */

import { prisma } from "@/lib/prisma";
import { generateAccessToken } from "@/lib/auth/jwt";
import crypto from "crypto";
import { StepUpMethod } from "@prisma/client";

const ANALYTICS_UNLOCK_DURATION_HOURS = 24;
const ANALYTICS_UNLOCK_DURATION_SECONDS = ANALYTICS_UNLOCK_DURATION_HOURS * 60 * 60;

const CHALLENGE_TTL_MINUTES = 10;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

export interface StepUpChallenge {
  challengeId: string;
  method: StepUpMethod;
  expiresAt: Date;
}

export interface VerifyAnalyticsUnlockResult {
  ok: boolean;
  reason?:
    | "missing_token"
    | "invalid_token"
    | "expired"
    | "wrong_purpose"
    | "not_unlocked"
    | "unknown";
  payload?: any;
}

/**
 * Normalize incoming method (string/UI) into Prisma StepUpMethod enum.
 */
function normalizeStepUpMethod(input: StepUpMethod | string): StepUpMethod {
  if (typeof input !== "string") return input;

  const v = input.trim().toLowerCase();
  const enumValues = Object.values(StepUpMethod) as string[];

  const match = (candidates: string[]) =>
    enumValues.find((ev) =>
      candidates.some((c) => ev.toLowerCase() === c.toLowerCase())
    ) as StepUpMethod | undefined;

  const totp = match(["totp"]);
  const pin = match(["pin", "analytics_pin"]);

  if (v === "totp" && totp) return totp;
  if ((v === "pin" || v === "analytics_pin") && pin) return pin;

  const direct = enumValues.find((ev) => ev.toLowerCase() === v);
  if (direct) return direct as StepUpMethod;

  return (totp ?? (enumValues[0] as StepUpMethod)) as StepUpMethod;
}

function addMinutes(d: Date, minutes: number) {
  return new Date(d.getTime() + minutes * 60 * 1000);
}

function addSeconds(d: Date, seconds: number) {
  return new Date(d.getTime() + seconds * 1000);
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
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
  if (userRole === "OWNER" || userRole === "owner") {
    if (sessionAgeHours < 8 && !isNewDevice && !ipChanged) return false;
  }
  return true;
}

/**
 * Start step-up challenge for analytics
 */
export async function startAnalyticsStepUp(
  tenantId: string,
  userId: string,
  method: StepUpMethod | string,
  ipAddress?: string,
  userAgent?: string,
  deviceId?: string
): Promise<StepUpChallenge> {
  const normalizedMethod = normalizeStepUpMethod(method);

  const existingLocked = await prisma.stepUpSession.findFirst({
    where: {
      tenantId,
      userId,
      purpose: "analytics_unlock",
      lockedUntil: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" as any },
  });

  if (existingLocked?.lockedUntil) {
    throw new Error(
      `Step-up authentication is locked. Try again after ${existingLocked.lockedUntil.toISOString()}`
    );
  }

  const challengeId = crypto.randomBytes(16).toString("hex");
  const now = new Date();
  const expiresAt = addMinutes(now, CHALLENGE_TTL_MINUTES);

  await prisma.stepUpSession.create({
    data: {
      tenantId,
      userId,
      purpose: "analytics_unlock",
      method: normalizedMethod as any,
      challengeIdHash: sha256Hex(challengeId) as any,
      expiresAt: expiresAt as any,
      failedAttempts: 0 as any,
      lockedUntil: null as any,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      deviceId: deviceId ?? null,
    } as any,
  });

  return { challengeId, method: normalizedMethod, expiresAt };
}

/**
 * Complete verification and issue an "analytics unlock" access token.
 * Your API layer should supply verificationPassed (OTP/TOTP/PIN validation).
 */
export async function completeAnalyticsStepUp(
  tenantId: string,
  userId: string,
  challengeId: string,
  verificationPassed: boolean
): Promise<{ unlockedUntil: Date; token: string }> {
  const now = new Date();
  const challengeHash = sha256Hex(challengeId);

  const session = await prisma.stepUpSession.findFirst({
    where: {
      tenantId,
      userId,
      purpose: "analytics_unlock",
      challengeIdHash: challengeHash as any,
    },
    orderBy: { createdAt: "desc" as any },
  });

  if (!session) throw new Error("Step-up challenge not found.");
  if (session.lockedUntil && new Date(session.lockedUntil) > now) {
    throw new Error(
      `Step-up authentication is locked. Try again after ${new Date(
        session.lockedUntil
      ).toISOString()}`
    );
  }
  if (session.expiresAt && new Date(session.expiresAt) < now) {
    throw new Error("Step-up challenge expired. Please start again.");
  }

  const failedAttempts = Number(session.failedAttempts ?? 0);

  if (!verificationPassed) {
    const nextFailed = failedAttempts + 1;
    const shouldLock = nextFailed >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = shouldLock ? addMinutes(now, LOCKOUT_DURATION_MINUTES) : null;

    await prisma.stepUpSession.update({
      where: { id: session.id } as any,
      data: {
        failedAttempts: nextFailed as any,
        lockedUntil: lockedUntil as any,
        lastAttemptAt: now as any,
      } as any,
    });

    if (shouldLock) {
      throw new Error(
        `Too many failed attempts. Locked until ${lockedUntil!.toISOString()}`
      );
    }
    throw new Error("Verification failed.");
  }

  const unlockedUntil = addSeconds(now, ANALYTICS_UNLOCK_DURATION_SECONDS);

  await prisma.stepUpSession.update({
    where: { id: session.id } as any,
    data: {
      verifiedAt: now as any,
      unlockedUntil: unlockedUntil as any,
      failedAttempts: 0 as any,
      lockedUntil: null as any,
    } as any,
  });

  const token = generateAccessToken({
    tenantId,
    userId,
    purpose: "analytics_unlock",
    exp: Math.floor(unlockedUntil.getTime() / 1000),
  } as any);

  return { unlockedUntil, token };
}

/**
 * Convenience check: is analytics currently unlocked?
 */
export async function isAnalyticsUnlocked(
  tenantId: string,
  userId: string
): Promise<boolean> {
  const now = new Date();
  const latest = await prisma.stepUpSession.findFirst({
    where: {
      tenantId,
      userId,
      purpose: "analytics_unlock",
      unlockedUntil: { gt: now } as any,
    },
    orderBy: { unlockedUntil: "desc" as any },
  });

  return Boolean(latest);
}

/* ----------------------------------------------------------------------------
 * ✅ Compatibility exports (so your existing API routes compile)
 * ----------------------------------------------------------------------------
 * Your routes currently import:
 *   - verifyAnalyticsStepUp
 *   - verifyAnalyticsUnlockToken
 *
 * We implement them as thin wrappers around the newer functions.
 */

/**
 * verifyAnalyticsStepUp
 * - Wrapper around completeAnalyticsStepUp
 * - Accepts flexible params so existing route code doesn't need changes
 */
export async function verifyAnalyticsStepUp(args: {
  tenantId: string;
  userId: string;
  challengeId: string;
  verificationPassed: boolean;
}): Promise<{ ok: boolean; token?: string; unlockedUntil?: Date; error?: string }> {
  try {
    const { tenantId, userId, challengeId, verificationPassed } = args;
    const res = await completeAnalyticsStepUp(
      tenantId,
      userId,
      challengeId,
      verificationPassed
    );
    return { ok: true, token: res.token, unlockedUntil: res.unlockedUntil };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Verification failed" };
  }
}

/**
 * verifyAnalyticsUnlockToken
 * - Minimal validator used by analytics routes to gate access.
 * - If you later add JWT verification (recommended), wire it in here.
 *
 * For now this checks server-side unlock state to avoid relying solely on token parsing.
 */
export async function verifyAnalyticsUnlockToken(args: {
  tenantId: string;
  userId: string;
  token?: string | null;
}): Promise<VerifyAnalyticsUnlockResult> {
  try {
    const { tenantId, userId, token } = args;

    if (!token) return { ok: false, reason: "missing_token" };

    // Strong check: server-side unlocked window
    const unlocked = await isAnalyticsUnlocked(tenantId, userId);
    if (!unlocked) return { ok: false, reason: "not_unlocked" };

    // Optional lightweight payload (don’t parse/verify JWT here unless you have a verifier)
    return { ok: true, payload: { tenantId, userId } };
  } catch {
    return { ok: false, reason: "unknown" };
  }
}
