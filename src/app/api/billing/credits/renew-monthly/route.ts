/**
 * Renew Monthly Credits
 * 
 * POST /api/billing/credits/renew-monthly
 * 
 * Checks if monthly credits need to be granted and grants them.
 * Should be called by a cron job or scheduled task.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { grantMonthlyCredits } from "@/lib/billing/credits";

export async function POST(request: NextRequest) {
  try {
    // Optional: require authentication for manual triggers
    // For cron jobs, you might want to use an API key instead
    try {
      const user = await getSessionUser();
      // If user is authenticated, process only their org
      if (user?.tenantId) {
        const subscription = await prisma.subscription.findUnique({
          where: { tenantId: user.tenantId },
        });

        if (!subscription || subscription.planType !== 'one_time' || !subscription.oneTimePurchasedAt) {
          return NextResponse.json({ 
            error: 'No active subscription found' 
          }, { status: 400 });
        }

        if (!subscription.monthlyCreditGrant || subscription.monthlyCreditGrant === 0) {
          return NextResponse.json({ 
            message: 'No monthly credit grant configured',
            granted: false 
          });
        }

        await grantMonthlyCredits(
          user.tenantId,
          user.tenantId,
          subscription.monthlyCreditGrant
        );

        return NextResponse.json({
          success: true,
          message: 'Monthly credits granted',
          orgId: user.tenantId,
          amount: subscription.monthlyCreditGrant,
        });
      }
    } catch {
      // If not authenticated, proceed with bulk processing (for cron)
    }

    // Bulk processing for all active subscriptions (for cron jobs)
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        planType: 'one_time',
        oneTimePurchasedAt: { not: null },
        monthlyCreditGrant: { gt: 0 },
      },
    });

    const results = [];

    for (const subscription of activeSubscriptions) {
      try {
        await grantMonthlyCredits(
          subscription.tenantId,
          subscription.tenantId,
          subscription.monthlyCreditGrant
        );
        results.push({
          orgId: subscription.tenantId,
          success: true,
          amount: subscription.monthlyCreditGrant,
        });
      } catch (error: any) {
        results.push({
          orgId: subscription.tenantId,
          success: false,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} subscriptions`,
      results,
    });
  } catch (error: any) {
    console.error('Monthly credit renewal error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to renew monthly credits' },
      { status: 500 }
    );
  }
}
