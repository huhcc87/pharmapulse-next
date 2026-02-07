/**
 * Usage Counters & Metering System
 * 
 * Server-side metering for:
 * - scan_count
 * - ocr_pages
 * - ai_tokens
 * - invoices
 * - exports
 * - api_calls
 */

import { prisma } from "@/lib/prisma";

export type MetricName = 
  | 'scan_count'
  | 'ocr_pages'
  | 'ai_tokens'
  | 'invoices'
  | 'exports'
  | 'api_calls';

export interface UsageCounter {
  orgId: string;
  licenseId: string | null;
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  metricName: MetricName;
  countValue: number;
  softLimit: number | null;
  hardLimit: number | null;
  overageCount: number;
}

/**
 * Get or create usage counter for a period
 */
export async function getOrCreateUsageCounter(
  orgId: string,
  tenantId: string,
  licenseId: string | null,
  metricName: MetricName,
  periodStart: Date,
  periodEnd: Date
): Promise<UsageCounter> {
  const counter = await prisma.usageCounter.findUnique({
    where: {
      orgId_licenseId_periodStart_metricName: {
        orgId,
        licenseId: licenseId || '',
        periodStart,
        metricName,
      },
    },
  });

  if (counter) {
    return {
      orgId: counter.orgId,
      licenseId: counter.licenseId,
      tenantId: counter.tenantId,
      periodStart: counter.periodStart,
      periodEnd: counter.periodEnd,
      metricName: counter.metricName as MetricName,
      countValue: Number(counter.countValue),
      softLimit: counter.softLimit ? Number(counter.softLimit) : null,
      hardLimit: counter.hardLimit ? Number(counter.hardLimit) : null,
      overageCount: Number(counter.overageCount),
    };
  }

  // Create new counter
  const created = await prisma.usageCounter.create({
    data: {
      orgId,
      tenantId,
      licenseId: licenseId || null,
      metricName,
      periodStart,
      periodEnd,
      countValue: 0,
      overageCount: 0,
    },
  });

  return {
    orgId: created.orgId,
    licenseId: created.licenseId,
    tenantId: created.tenantId,
    periodStart: created.periodStart,
    periodEnd: created.periodEnd,
    metricName: created.metricName as MetricName,
    countValue: Number(created.countValue),
    softLimit: created.softLimit ? Number(created.softLimit) : null,
    hardLimit: created.hardLimit ? Number(created.hardLimit) : null,
    overageCount: Number(created.overageCount),
  };
}

/**
 * Increment usage counter
 * Returns: { success, blocked, warning, newCount, overage }
 */
export async function incrementUsage(
  orgId: string,
  tenantId: string,
  licenseId: string | null,
  metricName: MetricName,
  amount: number = 1,
  periodStart?: Date,
  periodEnd?: Date
): Promise<{
  success: boolean;
  blocked: boolean;
  warning: boolean;
  newCount: number;
  overage: number;
}> {
  // Default to current month
  const now = new Date();
  if (!periodStart) {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (!periodEnd) {
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  const counter = await getOrCreateUsageCounter(
    orgId,
    tenantId,
    licenseId,
    metricName,
    periodStart,
    periodEnd
  );

  const newCount = counter.countValue + amount;
  const wasOverLimit = counter.hardLimit ? counter.countValue >= counter.hardLimit : false;
  const willBeOverLimit = counter.hardLimit ? newCount >= counter.hardLimit : false;
  const isOverSoftLimit = counter.softLimit ? newCount >= counter.softLimit : false;

  // Calculate overage
  let overage = 0;
  if (counter.hardLimit && newCount > counter.hardLimit) {
    overage = newCount - counter.hardLimit;
  }

  // Update counter
  await prisma.usageCounter.update({
    where: {
      orgId_licenseId_periodStart_metricName: {
        orgId,
        licenseId: licenseId || '',
        periodStart,
        metricName,
      },
    },
    data: {
      countValue: newCount,
      overageCount: overage,
    },
  });

  return {
    success: !willBeOverLimit,
    blocked: willBeOverLimit,
    warning: isOverSoftLimit && !willBeOverLimit,
    newCount,
    overage,
  };
}

/**
 * Get usage summary for an org
 */
export async function getUsageSummary(
  orgId: string,
  periodStart?: Date,
  periodEnd?: Date
): Promise<Record<MetricName, {
  count: number;
  softLimit: number | null;
  hardLimit: number | null;
  overage: number;
  warning: boolean;
  blocked: boolean;
}>> {
  const now = new Date();
  if (!periodStart) {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (!periodEnd) {
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  const counters = await prisma.usageCounter.findMany({
    where: {
      orgId,
      periodStart: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
  });

  const metrics: MetricName[] = [
    'scan_count',
    'ocr_pages',
    'ai_tokens',
    'invoices',
    'exports',
    'api_calls',
  ];

  const summary: Record<string, any> = {};

  for (const metric of metrics) {
    const counter = counters.find(c => c.metricName === metric);
    if (counter) {
      summary[metric] = {
        count: Number(counter.countValue),
        softLimit: counter.softLimit ? Number(counter.softLimit) : null,
        hardLimit: counter.hardLimit ? Number(counter.hardLimit) : null,
        overage: Number(counter.overageCount),
        warning: counter.softLimit ? Number(counter.countValue) >= Number(counter.softLimit) : false,
        blocked: counter.hardLimit ? Number(counter.countValue) >= Number(counter.hardLimit) : false,
      };
    } else {
      summary[metric] = {
        count: 0,
        softLimit: null,
        hardLimit: null,
        overage: 0,
        warning: false,
        blocked: false,
      };
    }
  }

  return summary as Record<MetricName, any>;
}

/**
 * Set limits for a metric
 */
export async function setUsageLimits(
  orgId: string,
  metricName: MetricName,
  softLimit: number | null,
  hardLimit: number | null,
  periodStart?: Date,
  periodEnd?: Date
): Promise<void> {
  const now = new Date();
  if (!periodStart) {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (!periodEnd) {
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  }

  await prisma.usageCounter.updateMany({
    where: {
      orgId,
      metricName,
      periodStart,
      periodEnd,
    },
    data: {
      softLimit: softLimit ? BigInt(softLimit) : null,
      hardLimit: hardLimit ? BigInt(hardLimit) : null,
    },
  });
}

/**
 * Check idempotency key (for paid endpoints)
 */
export async function checkIdempotencyKey(
  keyHash: string,
  orgId: string,
  endpoint: string
): Promise<{ exists: boolean; responseHash?: string; statusCode?: number }> {
  const record = await prisma.idempotencyKey.findUnique({
    where: { keyHash },
  });

  if (!record) {
    return { exists: false };
  }

  // Check if expired
  if (record.expiresAt < new Date()) {
    // Delete expired key
    await prisma.idempotencyKey.delete({
      where: { keyHash },
    });
    return { exists: false };
  }

  // Check if same org and endpoint
  if (record.orgId !== orgId || record.endpoint !== endpoint) {
    return { exists: false };
  }

  return {
    exists: true,
    responseHash: record.responseHash || undefined,
    statusCode: record.statusCode || undefined,
  };
}

/**
 * Store idempotency key result
 */
export async function storeIdempotencyKey(
  keyHash: string,
  orgId: string,
  endpoint: string,
  requestHash: string,
  responseHash: string,
  statusCode: number,
  expiresInSeconds: number = 3600
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + expiresInSeconds);

  await prisma.idempotencyKey.create({
    data: {
      keyHash,
      orgId,
      endpoint,
      requestHash,
      responseHash,
      statusCode,
      expiresAt,
    },
  });
}
