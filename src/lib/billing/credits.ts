/**
 * AI Credits System
 * 
 * Manages credits ledger, balance calculation, and monthly grants.
 */

import { prisma } from "@/lib/prisma";

export type CreditLedgerType = 
  | 'GRANT_MONTHLY'
  | 'TOPUP'
  | 'SPEND'
  | 'REFUND'
  | 'EXPIRED'
  | 'ADJUSTMENT';

/**
 * Get current credit balance for an org
 * Uses cache if available, otherwise calculates from ledger
 */
export async function getCreditBalance(
  orgId: string,
  tenantId: string,
  useCache: boolean = true
): Promise<number> {
  if (useCache) {
    const cached = await prisma.creditBalanceCache.findUnique({
      where: { orgId },
    });

    // Use cache if less than 5 minutes old
    if (cached) {
      const age = Date.now() - cached.lastCalculatedAt.getTime();
      if (age < 5 * 60 * 1000) {
        return cached.balance;
      }
    }
  }

  // Calculate from ledger
  const now = new Date();
  const ledgerEntries = await prisma.creditsLedger.findMany({
    where: {
      orgId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    },
  });

  const balance = ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0);

  // Update cache
  await prisma.creditBalanceCache.upsert({
    where: { orgId },
    create: {
      orgId,
      tenantId,
      balance,
      lastCalculatedAt: new Date(),
    },
    update: {
      balance,
      lastCalculatedAt: new Date(),
    },
  });

  return balance;
}

/**
 * Add credits to ledger (grant or top-up)
 */
export async function addCredits(
  orgId: string,
  tenantId: string,
  type: 'GRANT_MONTHLY' | 'TOPUP',
  amount: number,
  referenceId?: string,
  referenceType?: string,
  expiresAt?: Date,
  meta?: Record<string, any>
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Add ledger entry
    await tx.creditsLedger.create({
      data: {
        orgId,
        tenantId,
        type,
        amount,
        referenceId,
        referenceType,
        expiresAt,
        meta: meta || {},
      },
    });

    // Update cache
    const currentBalance = await getCreditBalance(orgId, tenantId, false);
    await tx.creditBalanceCache.upsert({
      where: { orgId },
      create: {
        orgId,
        tenantId,
        balance: currentBalance + amount,
        lastCalculatedAt: new Date(),
      },
      update: {
        balance: currentBalance + amount,
        lastCalculatedAt: new Date(),
      },
    });
  });
}

/**
 * Spend credits (atomic operation to prevent race conditions)
 */
export async function spendCredits(
  orgId: string,
  tenantId: string,
  amount: number,
  referenceId?: string,
  referenceType?: string,
  meta?: Record<string, any>
): Promise<{ success: boolean; balance: number; error?: string }> {
  return await prisma.$transaction(async (tx) => {
    // Get current balance
    const balance = await getCreditBalance(orgId, tenantId, false);

    if (balance < amount) {
      return {
        success: false,
        balance,
        error: `Insufficient credits. Required: ${amount}, Available: ${balance}`,
      };
    }

    // Add spend ledger entry
    await tx.creditsLedger.create({
      data: {
        orgId,
        tenantId,
        type: 'SPEND',
        amount: -amount, // Negative for spends
        referenceId,
        referenceType,
        meta: meta || {},
      },
    });

    // Update cache
    const newBalance = balance - amount;
    await tx.creditBalanceCache.upsert({
      where: { orgId },
      create: {
        orgId,
        tenantId,
        balance: newBalance,
        lastCalculatedAt: new Date(),
      },
      update: {
        balance: newBalance,
        lastCalculatedAt: new Date(),
      },
    });

    return {
      success: true,
      balance: newBalance,
    };
  });
}

/**
 * Get credits history (paginated)
 */
export async function getCreditsHistory(
  orgId: string,
  tenantId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Array<{
  id: string;
  type: string;
  amount: number;
  referenceId: string | null;
  referenceType: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  meta: any;
}>> {
  const entries = await prisma.creditsLedger.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });

  return entries.map(e => ({
    id: e.id,
    type: e.type,
    amount: e.amount,
    referenceId: e.referenceId,
    referenceType: e.referenceType,
    expiresAt: e.expiresAt,
    createdAt: e.createdAt,
    meta: e.meta,
  }));
}

/**
 * Expire monthly grants (run at end of month)
 */
export async function expireMonthlyGrants(orgId: string, tenantId: string): Promise<number> {
  const now = new Date();
  const expiredEntries = await prisma.creditsLedger.findMany({
    where: {
      orgId,
      type: 'GRANT_MONTHLY',
      expiresAt: {
        lte: now,
      },
      amount: {
        gt: 0, // Only expire positive amounts
      },
    },
  });

  if (expiredEntries.length === 0) {
    return 0;
  }

  let totalExpired = 0;

  await prisma.$transaction(async (tx) => {
    for (const entry of expiredEntries) {
      // Create expiration entry
      await tx.creditsLedger.create({
        data: {
          orgId,
          tenantId,
          type: 'EXPIRED',
          amount: -entry.amount, // Negative to offset the grant
          referenceId: entry.id,
          referenceType: 'grant_expiration',
          meta: {
            originalGrantId: entry.id,
            originalGrantDate: entry.createdAt,
          },
        },
      });

      totalExpired += entry.amount;
    }

    // Update cache
    const currentBalance = await getCreditBalance(orgId, tenantId, false);
    await tx.creditBalanceCache.upsert({
      where: { orgId },
      create: {
        orgId,
        tenantId,
        balance: currentBalance - totalExpired,
        lastCalculatedAt: new Date(),
      },
      update: {
        balance: currentBalance - totalExpired,
        lastCalculatedAt: new Date(),
      },
    });
  });

  return totalExpired;
}

/**
 * Grant monthly credits to eligible orgs
 * Should be called by a scheduled job
 */
export async function grantMonthlyCredits(
  orgId: string,
  tenantId: string,
  amount: number
): Promise<void> {
  // Check if already granted this month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const existingGrant = await prisma.creditsLedger.findFirst({
    where: {
      orgId,
      type: 'GRANT_MONTHLY',
      createdAt: {
        gte: startOfMonth,
      },
    },
  });

  if (existingGrant) {
    // Already granted this month
    return;
  }

  // Calculate expiry (end of current month in Asia/Kolkata)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  await addCredits(
    orgId,
    tenantId,
    'GRANT_MONTHLY',
    amount,
    undefined,
    'monthly_grant',
    endOfMonth,
    {
      grantMonth: now.getMonth() + 1,
      grantYear: now.getFullYear(),
    }
  );
}
