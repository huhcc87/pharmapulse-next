// Credit Management Advanced
// Credit packages, expiry management, transfer, usage analytics

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface CreditPackage {
  name: string;
  credits: number;
  pricePaise: number;
  validityDays?: number; // Credits expire after N days
  bonusCredits?: number; // Bonus credits included
}

export interface CreditTransferData {
  fromTenantId: string;
  toTenantId: string;
  credits: number;
  reason?: string;
}

/**
 * Get credit packages
 */
export async function getCreditPackages(): Promise<CreditPackage[]> {
  // Standard credit packages
  return [
    {
      name: "Starter Pack",
      credits: 50000,
      pricePaise: 250000, // ₹2,500
      validityDays: 365,
      bonusCredits: 0,
    },
    {
      name: "Professional Pack",
      credits: 150000,
      pricePaise: 700000, // ₹7,000 (discount)
      validityDays: 365,
      bonusCredits: 10000,
    },
    {
      name: "Enterprise Pack",
      credits: 500000,
      pricePaise: 2000000, // ₹20,000 (discount)
      validityDays: 365,
      bonusCredits: 50000,
    },
  ];
}

/**
 * Purchase credit package
 */
export async function purchaseCreditPackage(
  tenantId: string,
  packageName: string
): Promise<{
  success: boolean;
  creditsAdded: number;
  expiresAt?: Date;
}> {
  try {
    const packages = await getCreditPackages();
    const creditPackage = packages.find((p) => p.name === packageName);

    if (!creditPackage) {
      throw new Error("Credit package not found");
    }

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Calculate expiry
    let expiresAt: Date | undefined;
    if (creditPackage.validityDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + creditPackage.validityDays);
    }

    // Add credits to ledger
    const totalCredits = creditPackage.credits + (creditPackage.bonusCredits || 0);
    
    await prisma.creditsLedger.create({
      data: {
        tenantId,
        type: "PURCHASE",
        amount: totalCredits,
        description: `Purchased ${packageName}`,
        metadata: {
          packageName,
          baseCredits: creditPackage.credits,
          bonusCredits: creditPackage.bonusCredits || 0,
          expiresAt: expiresAt?.toISOString(),
        },
      },
    });

    // Update subscription balance
    await prisma.subscription.update({
      where: { tenantId },
      data: {
        aiCredits: subscription.aiCredits + totalCredits,
      },
    });

    return {
      success: true,
      creditsAdded: totalCredits,
      expiresAt,
    };
  } catch (error: any) {
    console.error("Purchase credit package error:", error);
    throw error;
  }
}

/**
 * Transfer credits between tenants
 */
export async function transferCredits(
  tenantId: string,
  data: CreditTransferData
): Promise<{
  success: boolean;
  transferId: string;
}> {
  try {
    // Verify sender has enough credits
    const fromSubscription = await prisma.subscription.findUnique({
      where: { tenantId: data.fromTenantId },
    });

    if (!fromSubscription) {
      throw new Error("Source subscription not found");
    }

    if (fromSubscription.aiCredits < data.credits) {
      throw new Error("Insufficient credits");
    }

    // Get receiver subscription
    const toSubscription = await prisma.subscription.findUnique({
      where: { tenantId: data.toTenantId },
    });

    if (!toSubscription) {
      throw new Error("Destination subscription not found");
    }

    // Create transfer records
    const transferId = `TRANSFER-${Date.now()}`;

    // Debit from sender
    await prisma.creditsLedger.create({
      data: {
        tenantId: data.fromTenantId,
        type: "TRANSFER_OUT",
        amount: -data.credits,
        description: `Transferred to ${data.toTenantId}`,
        metadata: {
          transferId,
          reason: data.reason,
        },
      },
    });

    // Credit to receiver
    await prisma.creditsLedger.create({
      data: {
        tenantId: data.toTenantId,
        type: "TRANSFER_IN",
        amount: data.credits,
        description: `Transferred from ${data.fromTenantId}`,
        metadata: {
          transferId,
          reason: data.reason,
        },
      },
    });

    // Update balances
    await prisma.subscription.update({
      where: { tenantId: data.fromTenantId },
      data: {
        aiCredits: fromSubscription.aiCredits - data.credits,
      },
    });

    await prisma.subscription.update({
      where: { tenantId: data.toTenantId },
      data: {
        aiCredits: toSubscription.aiCredits + data.credits,
      },
    });

    return {
      success: true,
      transferId,
    };
  } catch (error: any) {
    console.error("Transfer credits error:", error);
    throw error;
  }
}

/**
 * Get credit usage analytics
 */
export async function getCreditUsageAnalytics(
  tenantId: string,
  period: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" = "MONTHLY"
): Promise<{
  period: string;
  totalCredits: number;
  creditsUsed: number;
  creditsRemaining: number;
  usageByCategory?: Record<string, number>;
  dailyUsage?: Array<{
    date: string;
    credits: number;
  }>;
}> {
  try {
    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    if (period === "WEEKLY") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "MONTHLY") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === "QUARTERLY") {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
    });

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Get credit usage from ledger
    const ledgerEntries = await prisma.creditsLedger.findMany({
      where: {
        tenantId,
        type: {
          in: ["USAGE", "DEBIT"],
        },
        createdAt: {
          gte: startDate,
        },
      },
    });

    const creditsUsed = ledgerEntries.reduce((sum, entry) => sum + Math.abs(entry.amount || 0), 0);

    // Daily usage
    const dailyUsageMap: Record<string, number> = {};
    for (const entry of ledgerEntries) {
      const date = entry.createdAt.toISOString().split("T")[0];
      dailyUsageMap[date] = (dailyUsageMap[date] || 0) + Math.abs(entry.amount || 0);
    }

    const dailyUsage = Object.entries(dailyUsageMap).map(([date, credits]) => ({
      date,
      credits,
    })).sort((a, b) => a.date.localeCompare(b.date));

    return {
      period,
      totalCredits: subscription.aiCredits,
      creditsUsed,
      creditsRemaining: subscription.aiCredits - subscription.aiCreditsUsed,
      dailyUsage,
    };
  } catch (error: any) {
    console.error("Get credit usage analytics error:", error);
    throw error;
  }
}

/**
 * Check and expire credits
 */
export async function expireCredits(tenantId?: string): Promise<number> {
  try {
    const where: any = {
      type: "PURCHASE",
      metadata: {
        path: ["expiresAt"],
        not: null,
      },
    };
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const expiredEntries = await prisma.creditsLedger.findMany({
      where,
    });

    let expiredCount = 0;

    for (const entry of expiredEntries) {
      const metadata = entry.metadata as any;
      if (metadata?.expiresAt) {
        const expiresAt = new Date(metadata.expiresAt);
        if (expiresAt < new Date()) {
          // Mark as expired (would need additional schema for tracking)
          expiredCount++;
        }
      }
    }

    return expiredCount;
  } catch (error: any) {
    console.error("Expire credits error:", error);
    throw error;
  }
}
