// src/lib/referrals/referral-manager.ts
// Referral Program Management
// Handles referral code generation, tracking, and rewards

import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export interface CreateReferralCodeInput {
  customerId: number;
  tenantId?: number;
}

export interface ReferralCodeResult {
  success: boolean;
  referralCode?: string;
  error?: string;
}

/**
 * Generate referral code for customer
 * Format: REF-XXXXXX (6 alphanumeric characters)
 */
export async function generateReferralCode(
  input: CreateReferralCodeInput
): Promise<ReferralCodeResult> {
  try {
    const { customerId, tenantId = 1 } = input;

    const existing = await prisma.referralCode.findFirst({
      where: {
        referrerId: customerId,
        tenantId,
        isActive: true,
      },
    });

    if (existing) return { success: true, referralCode: existing.code };

    let code = "";
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 15) {
      const token = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars
      code = `REF-${token}`;

      const exists = await prisma.referralCode.findUnique({
        where: { code },
      });

      if (!exists) isUnique = true;
      attempts++;
    }

    if (!isUnique) {
      return { success: false, error: "Failed to generate unique referral code" };
    }

    const referralCode = await prisma.referralCode.create({
      data: {
        tenantId,
        referrerId: customerId,
        code,
        isActive: true,
        validFrom: new Date(),
        referrerRewardType: "POINTS",
        referrerRewardValue: 100,
        referredRewardType: "POINTS",
        referredRewardValue: 50,
      },
    });

    return { success: true, referralCode: referralCode.code };
  } catch (error: any) {
    console.error("Referral code generation error:", error);
    return {
      success: false,
      error: error?.message || "Referral code generation failed",
    };
  }
}

/**
 * Process referral (when new customer uses referral code)
 */
export async function processReferral(
  referralCode: string,
  newCustomerId: number,
  tenantId: number = 1
): Promise<{ success: boolean; error?: string }> {
  try {
    const code = await prisma.referralCode.findUnique({
      where: { code: referralCode },
      include: { referrer: true },
    });

    if (!code || !code.isActive) {
      return { success: false, error: "Invalid or inactive referral code" };
    }

    // ReferralCode is tenant-scoped in your schema
    if (code.tenantId !== tenantId) {
      return { success: false, error: "Referral code does not match tenant" };
    }

    if (code.referrerId === newCustomerId) {
      return { success: false, error: "Cannot use your own referral code" };
    }

    // Referral model appears NOT tenant-scoped (no tenantId), so we don't filter by tenantId here.
    const existingReferral = await prisma.referral.findFirst({
      where: {
        referrerId: code.referrerId,
        referredCustomerId: newCustomerId,
      },
    });

    if (existingReferral) {
      return { success: false, error: "Referral already processed" };
    }

    await prisma.referral.create({
      data: {
        referrerId: code.referrerId,
        referredCustomerId: newCustomerId,
        referralCodeId: code.id,
        status: "PENDING",
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("Referral processing error:", error);
    return { success: false, error: error?.message || "Referral processing failed" };
  }
}

/**
 * Confirm referral (after first purchase)
 *
 * Your Referral Prisma model does NOT have:
 * - tenantId
 * - firstPurchaseAmountPaise
 * - confirmedAt
 *
 * So we only update status to CONFIRMED.
 */
export async function confirmReferral(
  referredCustomerId: number,
  firstPurchaseAmountPaise: number, // kept for API compatibility
  tenantId: number = 1
): Promise<{ success: boolean; error?: string }> {
  try {
    const referral = await prisma.referral.findFirst({
      where: {
        referredCustomerId,
        status: "PENDING",
      },
      include: {
        referralCode: true,
      },
    });

    if (!referral) {
      return { success: false, error: "No pending referral found" };
    }

    // Still enforce tenant via referralCode
    if (referral.referralCode?.tenantId !== tenantId) {
      return { success: false, error: "Referral does not match tenant" };
    }

    await prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: "CONFIRMED",
      },
    });

    // Not stored (schema doesn't support it yet)
    void firstPurchaseAmountPaise;

    return { success: true };
  } catch (error: any) {
    console.error("Referral confirmation error:", error);
    return {
      success: false,
      error: error?.message || "Referral confirmation failed",
    };
  }
}

/**
 * Get referral analytics
 */
export async function getReferralAnalytics(
  customerId: number,
  tenantId: number = 1
): Promise<{
  totalReferrals: number;
  confirmedReferrals: number;
  pendingReferrals: number;
  totalRewardsPaise: number;
}> {
  const referrals = await prisma.referral.findMany({
    where: { referrerId: customerId },
    include: { referralCode: true },
  });

  const tenantReferrals = referrals.filter(
    (r: any) => r.referralCode?.tenantId === tenantId
  );

  return {
    totalReferrals: tenantReferrals.length,
    confirmedReferrals: tenantReferrals.filter((r: any) => r.status === "CONFIRMED").length,
    pendingReferrals: tenantReferrals.filter((r: any) => r.status === "PENDING").length,
    totalRewardsPaise: 0,
  };
}
