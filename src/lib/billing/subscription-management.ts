// Subscription Management Advanced
// Plan comparison, upgrade/downgrade, pause/resume, cancellation

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface PlanComparison {
  planName: string;
  pricePaise: number;
  features: string[];
  credits: number;
  branches: number;
}

export interface UpgradeDowngradeResult {
  success: boolean;
  newPlan: string;
  proratedAmountPaise?: number;
  effectiveDate: Date;
}

/**
 * Get plan comparison
 */
export async function getPlanComparison(): Promise<PlanComparison[]> {
  return [
    {
      planName: "PharmaPulse One",
      pricePaise: 1500000, // ₹15,000 one-time
      features: [
        "1 Branch",
        "All Features",
        "10,000 AI Credits/month",
        "Priority Support",
      ],
      credits: 10000,
      branches: 1,
    },
  ];
}

/**
 * Upgrade subscription plan
 */
export async function upgradeSubscription(
  tenantId: string,
  newPlan: string
): Promise<UpgradeDowngradeResult> {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Calculate prorated amount (simplified)
    const proratedAmount = 0; // Would calculate based on remaining period

    // Update subscription
    await prisma.subscription.update({
      where: { tenantId },
      data: {
        plan: newPlan,
        // Update other plan-specific fields
      },
    });

    return {
      success: true,
      newPlan,
      proratedAmountPaise: proratedAmount,
      effectiveDate: new Date(),
    };
  } catch (error: any) {
    console.error("Upgrade subscription error:", error);
    throw error;
  }
}

/**
 * Pause subscription
 */
export async function pauseSubscription(
  tenantId: string,
  reason?: string
): Promise<{
  success: boolean;
  pausedUntil?: Date;
}> {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Calculate pause duration (default 30 days)
    const pausedUntil = new Date();
    pausedUntil.setDate(pausedUntil.getDate() + 30);

    // Update subscription status
    await prisma.subscription.update({
      where: { tenantId },
      data: {
        status: "past_due", // Use existing status
        lockReason: reason || "Paused by user",
      },
    });

    return {
      success: true,
      pausedUntil,
    };
  } catch (error: any) {
    console.error("Pause subscription error:", error);
    throw error;
  }
}

/**
 * Resume subscription
 */
export async function resumeSubscription(
  tenantId: string
): Promise<{
  success: boolean;
}> {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Update subscription status
    await prisma.subscription.update({
      where: { tenantId },
      data: {
        status: "active",
        lockReason: null,
      },
    });

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("Resume subscription error:", error);
    throw error;
  }
}

/**
 * Cancel subscription with retention offers
 */
export async function cancelSubscription(
  tenantId: string,
  reason?: string
): Promise<{
  success: boolean;
  retentionOffers?: Array<{
    type: string;
    description: string;
    discountPercent: number;
  }>;
}> {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Generate retention offers
    const retentionOffers = [
      {
        type: "DISCOUNT",
        description: "50% off next renewal",
        discountPercent: 50,
      },
      {
        type: "EXTENDED_TRIAL",
        description: "30 days free extension",
        discountPercent: 0,
      },
    ];

    // Update subscription (don't cancel immediately, mark for cancellation)
    await prisma.subscription.update({
      where: { tenantId },
      data: {
        autoRenew: false,
        lockReason: reason || "Cancellation requested",
      },
    });

    return {
      success: true,
      retentionOffers,
    };
  } catch (error: any) {
    console.error("Cancel subscription error:", error);
    throw error;
  }
}
