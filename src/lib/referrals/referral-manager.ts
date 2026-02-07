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

    // Check if customer already has a referral code
    const existing = await prisma.referralCode.findFirst({
      where: {
        referrerId: customerId,
        tenantId,
        isActive: true,
      },
    });

    if (existing) {
      return {
        success: true,
        referralCode: existing.code,
      };
    }

    // Generate unique referral code
    let code: string;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      // Generate 6-character alphanumeric code
      const randomBytes = crypto.randomBytes(3);
      code = `REF-${randomBytes.toString("base64").replace(/[^A-Z0-9]/g, "").substring(0, 6).toUpperCase()}`;

      // Check if code already exists
      const exists = await prisma.referralCode.findUnique({
        where: { code },
      });

      if (!exists) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return {
        success: false,
        error: "Failed to generate unique referral code",
      };
    }

    // Create referral code
    const referralCode = await prisma.referralCode.create({
      data: {
        tenantId,
        referrerId: customerId,
        code: code!,
        isActive: true,
        validFrom: new Date(),
        referrerRewardType: "POINTS",
        referrerRewardValue: 100, // Default: 100 points
        referredRewardType: "POINTS",
        referredRewardValue: 50, // Default: 50 points
      },
    });

    return {
      success: true,
      referralCode: referralCode.code,
    };
  } catch (error: any) {
    console.error("Referral code generation error:", error);
    return {
      success: false,
      error: error.message || "Referral code generation failed",
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
    // Find referral code
    const code = await prisma.referralCode.findUnique({
      where: { code: referralCode },
      include: {
        referrer: true,
      },
    });

    if (!code || !code.isActive) {
      return {
        success: false,
        error: "Invalid or inactive referral code",
      };
    }

    // Check if customer is trying to refer themselves
    if (code.referrerId === newCustomerId) {
      return {
        success: false,
        error: "Cannot use your own referral code",
      };
    }

    // Check if referral already exists
    const existingReferral = await prisma.referral.findFirst({
      where: {
        referrerId: code.customerId,
        referredCustomerId: newCustomerId,
        tenantId,
      },
    });

    if (existingReferral) {
      return {
        success: false,
        error: "Referral already processed",
      };
    }

    // Create referral record
    await prisma.referral.create({
      data: {
        tenantId,
        referrerId: code.referrerId,
        referredCustomerId: newCustomerId,
        referralCodeId: code.id,
        status: "PENDING", // Will be confirmed after first purchase
      },
    });

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("Referral processing error:", error);
    return {
      success: false,
      error: error.message || "Referral processing failed",
    };
  }
}

/**
 * Confirm referral (after first purchase)
 */
export async function confirmReferral(
  referredCustomerId: number,
  firstPurchaseAmountPaise: number,
  tenantId: number = 1
): Promise<{ success: boolean; error?: string }> {
  try {
    // Find pending referral
    const referral = await prisma.referral.findFirst({
      where: {
        referredCustomerId,
        tenantId,
        status: "PENDING",
      },
      include: {
        referrer: true,
        referralCode: true,
      },
    });

    if (!referral) {
      return {
        success: false,
        error: "No pending referral found",
      };
    }

    // Update referral status
    await prisma.referral.update({
      where: { id: referral.id },
      data: {
        status: "CONFIRMED",
        firstPurchaseAmountPaise,
        confirmedAt: new Date(),
      },
    });

    // Award rewards (points or cashback)
    // This would integrate with loyalty system
    // For now, just mark as confirmed

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("Referral confirmation error:", error);
    return {
      success: false,
      error: error.message || "Referral confirmation failed",
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
    where: {
      referrerId: customerId,
      tenantId,
    },
  });

  return {
    totalReferrals: referrals.length,
    confirmedReferrals: referrals.filter((r) => r.status === "CONFIRMED").length,
    pendingReferrals: referrals.filter((r) => r.status === "PENDING").length,
    totalRewardsPaise: 0, // Would calculate from rewards system
  };
}
