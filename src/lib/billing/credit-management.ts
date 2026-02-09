// src/lib/billing/credit-management.ts
// Credit Management Advanced
// Credit packages, expiry management, transfer, usage analytics

import { prisma } from "@/lib/prisma";

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
      pricePaise: 700000, // ₹7,000
      validityDays: 365,
      bonusCredits: 10000,
    },
    {
      name: "Enterprise Pack",
      credits: 500000,
      pricePaise: 2000000, // ₹20,000
      validityDays: 365,
      bonusCredits: 50000,
    },
  ];
}

/**
 * Purchase credit package
 *
 * Schema note:
 * - CreditsLedger requires orgId
 * - CreditsLedger does NOT have description/metadata (per your earlier errors)
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
    if (!creditPackage) throw new Error("Credit package not found");

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
    });
    if (!subscription) throw new Error("Subscription not found");

    // Expiry returned to caller only (not stored in DB because schema lacks fields)
    let expiresAt: Date | undefined;
    if (creditPackage.validityDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + creditPackage.validityDays);
    }

    const totalCredits = creditPackage.credits + (creditPackage.bonusCredits || 0);

    await prisma.creditsLedger.create({
      data: {
        orgId: tenantId,     // ✅ required by schema
        tenantId,            // keep if your schema includes it (it compiled before)
        type: "PURCHASE",
        amount: totalCredits,
      },
    });

    await prisma.subscription.update({
      where: { tenantId },
      data: {
        aiCredits: (subscription.aiCredits ?? 0) + totalCredits,
      },
    });

    return { success: true, creditsAdded: totalCredits, expiresAt };
  } catch (error: any) {
    console.error("Purchase credit package error:", error);
    throw error;
  }
}

/**
 * Transfer credits between tenants
 *
 * Schema note:
 * - CreditsLedger requires orgId
 */
export async function transferCredits(
  tenantId: string,
  data: CreditTransferData
): Promise<{
  success: boolean;
  transferId: string;
}> {
  try {
    const fromSubscription = await prisma.subscription.findUnique({
      where: { tenantId: data.fromTenantId },
    });
    if (!fromSubscription) throw new Error("Source subscription not found");

    if ((fromSubscription.aiCredits ?? 0) < data.credits) {
      throw new Error("Insufficient credits");
    }

    const toSubscription = await prisma.subscription.findUnique({
      where: { tenantId: data.toTenantId },
    });
    if (!toSubscription) throw new Error("Destination subscription not found");

    const transferId = `TRANSFER-${Date.now()}`;

    // Debit sender
    await prisma.creditsLedger.create({
      data: {
        orgId: data.fromTenantId, // ✅ required
        tenantId: data.fromTenantId,
        type: "TRANSFER_OUT",
        amount: -data.credits,
      },
    });

    // Credit receiver
    await prisma.creditsLedger.create({
      data: {
        orgId: data.toTenantId, // ✅ required
        tenantId: data.toTenantId,
        type: "TRANSFER_IN",
        amount: data.credits,
      },
    });

    await prisma.subscription.update({
      where: { tenantId: data.fromTenantId },
      data: {
        aiCredits: (fromSubscription.aiCredits ?? 0) - data.credits,
      },
    });

    await prisma.subscription.update({
      where: { tenantId: data.toTenantId },
      data: {
        aiCredits: (toSubscription.aiCredits ?? 0) + data.credits,
      },
    });

    return { success: true, transferId };
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
  dailyUsage?: Array<{ date: string; credits: number }>;
}> {
  try {
    const now = new Date();
    const startDate =
      period === "WEEKLY"
        ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        : period === "MONTHLY"
        ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        : period === "QUARTERLY"
        ? new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const subscription = await prisma.subscription.findUnique({
      where: { tenantId },
    });
    if (!subscription) throw new Error("Subscription not found");

    const ledgerEntries = await prisma.creditsLedger.findMany({
      where: {
        tenantId,
        type: { in: ["USAGE", "DEBIT"] },
        createdAt: { gte: startDate },
      },
    });

    const creditsUsed = ledgerEntries.reduce(
      (sum, entry) => sum + Math.abs(entry.amount || 0),
      0
    );

    const dailyUsageMap: Record<string, number> = {};
    for (const entry of ledgerEntries) {
      const date = entry.createdAt.toISOString().split("T")[0];
      dailyUsageMap[date] = (dailyUsageMap[date] || 0) + Math.abs(entry.amount || 0);
    }

    const dailyUsage = Object.entries(dailyUsageMap)
      .map(([date, credits]) => ({ date, credits }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      period,
      totalCredits: subscription.aiCredits ?? 0,
      creditsUsed,
      creditsRemaining: (subscription.aiCredits ?? 0) - (subscription.aiCreditsUsed ?? 0),
      dailyUsage,
    };
  } catch (error: any) {
    console.error("Get credit usage analytics error:", error);
    throw error;
  }
}

/**
 * Check and expire credits
 *
 * Your schema currently doesn't support storing expiry in ledger,
 * so this is a safe no-op until you add expiresAt/metadata fields.
 */
export async function expireCredits(_tenantId?: string): Promise<number> {
  return 0;
}
