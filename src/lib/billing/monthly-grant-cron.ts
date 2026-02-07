/**
 * Monthly Credit Grant Cron Job
 * 
 * Grants 50,000 AI credits monthly to eligible orgs.
 * Should be run at the start of each month (Asia/Kolkata timezone).
 * 
 * Usage:
 * - Set up a cron job (e.g., using node-cron, Vercel Cron, or external scheduler)
 * - Run: node -e "require('./src/lib/billing/monthly-grant-cron').grantMonthlyCreditsToAll()"
 */

import { prisma } from "@/lib/prisma";
import { grantMonthlyCredits } from "./credits";

/**
 * Grant monthly credits to all eligible orgs
 * Eligibility: Plan type = 'one_time' AND oneTimePurchasedAt is not null
 */
export async function grantMonthlyCreditsToAll(): Promise<{
  success: number;
  failed: number;
  errors: Array<{ orgId: string; error: string }>;
}> {
  const errors: Array<{ orgId: string; error: string }> = [];
  let success = 0;
  let failed = 0;

  // Find all eligible subscriptions
  const eligibleSubscriptions = await prisma.subscription.findMany({
    where: {
      planType: 'one_time',
      oneTimePurchasedAt: {
        not: null,
      },
      monthlyCreditGrant: {
        gt: 0, // Only grant if monthly grant is configured
      },
    },
  });

  console.log(`Found ${eligibleSubscriptions.length} eligible subscriptions for monthly credit grant`);

  for (const sub of eligibleSubscriptions) {
    try {
      const orgId = sub.tenantId; // Assuming tenantId = orgId
      const amount = sub.monthlyCreditGrant || 50000; // Default 50K if not set

      await grantMonthlyCredits(orgId, sub.tenantId, amount);
      success++;

      console.log(`Granted ${amount} credits to org ${orgId}`);
    } catch (error: any) {
      failed++;
      errors.push({
        orgId: sub.tenantId,
        error: error.message || 'Unknown error',
      });
      console.error(`Failed to grant credits to org ${sub.tenantId}:`, error);
    }
  }

  return {
    success,
    failed,
    errors,
  };
}

/**
 * Run monthly grant for a specific org (for testing or manual triggers)
 */
export async function grantMonthlyCreditsForOrg(orgId: string, tenantId: string): Promise<void> {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
  });

  if (!subscription || subscription.planType !== 'one_time' || !subscription.oneTimePurchasedAt) {
    throw new Error('Org is not eligible for monthly credit grant');
  }

  const amount = subscription.monthlyCreditGrant || 50000;
  await grantMonthlyCredits(orgId, tenantId, amount);
}
