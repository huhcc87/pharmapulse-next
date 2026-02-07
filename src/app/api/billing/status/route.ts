/**
 * Get Billing Status
 * 
 * GET /api/billing/status
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCreditBalance } from "@/lib/billing/credits";

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    
    // If no user, return default inactive status (don't error out)
    // This allows the billing page to display properly even without auth
    if (!user) {
      return NextResponse.json({
        plan: {
          name: null,
          status: 'INACTIVE',
          purchasedAt: null,
          amountPaise: null,
          branchesIncluded: 1,
          prioritySupport: false,
        },
        renewal: {
          status: 'INACTIVE',
          nextDue: null,
          isPastDue: false,
        },
        credits: {
          balance: 0,
          monthlyGrant: 10000,
          yearlyLimit: 120000,
          used: 0,
          yearlyUsed: 0,
          monthlyUsed: 0,
          remaining: 0,
          remainingYearly: 120000,
          remainingMonthly: 10000,
        },
      });
    }

    const orgId = user.tenantId; // Assuming tenantId = orgId

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!subscription) {
      return NextResponse.json({
        plan: {
          name: null,
          status: 'INACTIVE',
          purchasedAt: null,
          amountPaise: null,
        },
        renewal: {
          status: 'INACTIVE',
          nextDue: null,
        },
        credits: {
          balance: 0,
          monthlyGrant: 10000,
          yearlyLimit: 120000,
          used: 0,
          yearlyUsed: 0,
          monthlyUsed: 0,
          remaining: 0,
          remainingYearly: 120000,
          remainingMonthly: 10000,
        },
      });
    }

    // Get credit balance (with error handling)
    let creditBalance = 0;
    try {
      creditBalance = await getCreditBalance(orgId, user.tenantId);
    } catch (error) {
      console.error('Error getting credit balance:', error);
      creditBalance = 0;
    }

    // Calculate used credits (total spent) - handle if creditsLedger doesn't exist
    let usedCredits: { _sum: { amount: number | null } } = { _sum: { amount: null } };
    let yearlyUsed: { _sum: { amount: number | null } } = { _sum: { amount: null } };
    let monthlyUsed: { _sum: { amount: number | null } } = { _sum: { amount: null } };

    try {
      usedCredits = await prisma.creditsLedger.aggregate({
        where: {
          orgId,
          type: 'SPEND',
        },
        _sum: {
          amount: true,
        },
      });

      // Calculate yearly used (from start of year)
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      yearlyUsed = await prisma.creditsLedger.aggregate({
        where: {
          orgId,
          type: 'SPEND',
          createdAt: {
            gte: startOfYear,
          },
        },
        _sum: {
          amount: true,
        },
      });

      // Calculate monthly used (from start of month)
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      monthlyUsed = await prisma.creditsLedger.aggregate({
        where: {
          orgId,
          type: 'SPEND',
          createdAt: {
            gte: startOfMonth,
          },
        },
        _sum: {
          amount: true,
        },
      });
    } catch (error) {
      console.error('Error calculating credits:', error);
      // Continue with default values
    }

    const totalUsed = Math.abs(usedCredits._sum.amount || 0);
    const yearlyUsedTotal = Math.abs(yearlyUsed._sum.amount || 0);
    const monthlyUsedTotal = Math.abs(monthlyUsed._sum.amount || 0);
    const yearlyCreditLimit = 120000; // 120,000 tokens per year
    const monthlyCreditLimit = 10000; // Default monthly grant (Subscription model doesn't have monthlyCreditGrant field)

    // Determine plan status
    const planStatus = subscription.planType === 'one_time' && subscription.oneTimePurchasedAt
      ? 'ACTIVE'
      : subscription.status === 'active'
      ? 'ACTIVE'
      : 'INACTIVE';

    // Determine renewal status  
    const renewalStatus = subscription.serviceRenewalStatus || subscription.status?.toUpperCase() || 'INACTIVE';
    const isPastDue = renewalStatus === 'PAST_DUE' || subscription.status === 'past_due';

    return NextResponse.json({
      plan: {
        name: subscription.planType === 'one_time' ? 'PharmaPulse One' : subscription.plan || 'Yearly Plan',
        status: planStatus,
        purchasedAt: subscription.oneTimePurchasedAt?.toISOString() || subscription.currentPeriodStart?.toISOString() || null,
        amountPaise: subscription.oneTimeAmountPaise || null,
        branchesIncluded: subscription.branchesIncluded || 1,
        prioritySupport: subscription.prioritySupport || false,
      },
      renewal: {
        status: renewalStatus,
        nextDue: subscription.serviceRenewalNextDue?.toISOString() || subscription.currentPeriodEnd?.toISOString() || null,
        isPastDue,
      },
      credits: {
        balance: creditBalance,
        monthlyGrant: monthlyCreditLimit,
        yearlyLimit: yearlyCreditLimit,
        used: totalUsed,
        yearlyUsed: yearlyUsedTotal,
        monthlyUsed: monthlyUsedTotal,
        remaining: creditBalance,
        remainingYearly: Math.max(0, yearlyCreditLimit - yearlyUsedTotal),
        remainingMonthly: Math.max(0, monthlyCreditLimit - monthlyUsedTotal),
      },
    });
  } catch (error: any) {
    console.error('Billing status error:', error);
    
    // Always return valid billing status structure, never errors
    // This ensures the billing page always displays properly
    return NextResponse.json({
      plan: {
        name: null,
        status: 'INACTIVE',
        purchasedAt: null,
        amountPaise: null,
        branchesIncluded: 1,
        prioritySupport: false,
      },
      renewal: {
        status: 'INACTIVE',
        nextDue: null,
        isPastDue: false,
      },
      credits: {
        balance: 0,
        monthlyGrant: 10000,
        yearlyLimit: 120000,
        used: 0,
        yearlyUsed: 0,
        monthlyUsed: 0,
        remaining: 0,
        remainingYearly: 120000,
        remainingMonthly: 10000,
      },
    });
  }
}
