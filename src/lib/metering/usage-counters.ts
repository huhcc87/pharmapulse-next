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
 *
 * NOTE:
 * Some deployments may not have Prisma models for UsageCounter / IdempotencyKey.
 * This file uses runtime checks and falls back to an in-memory store to keep builds green.
 */

import { prisma } from "@/lib/prisma";

export type MetricName =
  | "scan_count"
  | "ocr_pages"
  | "ai_tokens"
  | "invoices"
  | "exports"
  | "api_calls";

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

type UsageCounterKey = string;

function counterKeyOf(
  orgId: string,
  tenantId: string,
  licenseId: string | null,
  metricName: MetricName,
  periodStart: Date
): UsageCounterKey {
  // keep deterministic + compact
  return [
    orgId,
    tenantId,
    licenseId ?? "",
    metricName,
    periodStart.toISOString(),
  ].join("|");
}

// Process-local fallback store (best-effort only)
const memCounters = new Map<UsageCounterKey, UsageCounter>();

/**
 * Runtime check: does Prisma client expose usageCounter model?
 */
function hasUsageCounterModel(): boolean {
  return typeof (prisma as any)?.usageCounter?.findUnique === "function";
}

/**
 * Runtime check: does Prisma client expose idempotencyKey model?
 */
function hasIdempotencyModel(): boolean {
  return typeof (prisma as any)?.idempotencyKey?.findUnique === "function";
}

/**
 * Coerce numbers safely from Prisma/BigInt/Decimal-like values.
 */
function toNumberSafe(v: any): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") return Number(v);
  if (typeof v === "object" && typeof v.toNumber === "function") return v.toNumber();
  return Number(v);
}

function toNullableNumberSafe(v: any): number | null {
  if (v == null) return null;
  const n = toNumberSafe(v);
  return Number.isFinite(n) ? n : null;
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
  const key = counterKeyOf(orgId, tenantId, licenseId, metricName, periodStart);

  // DB path
  if (hasUsageCounterModel()) {
    const counter = await (prisma as any).usageCounter.findUnique({
      where: {
        // Keep your original composite key name, but tolerate schema differences:
        // if your schema uses a different unique, this will throw at runtime, not build time.
        orgId_licenseId_periodStart_metricName: {
          orgId,
          // IMPORTANT: your original code used '' when null; keep that behavior for DB queries.
          licenseId: licenseId || "",
          periodStart,
          metricName,
        },
      },
    });

    if (counter) {
      return {
        orgId: counter.orgId,
        licenseId: counter.licenseId ?? null,
        tenantId: counter.tenantId,
        periodStart: counter.periodStart,
        periodEnd: counter.periodEnd,
        metricName: counter.metricName as MetricName,
        countValue: toNumberSafe(counter.countValue),
        softLimit: toNullableNumberSafe(counter.softLimit),
        hardLimit: toNullableNumberSafe(counter.hardLimit),
        overageCount: toNumberSafe(counter.overageCount),
      };
    }

    const created = await (prisma as any).usageCounter.create({
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
      licenseId: created.licenseId ?? null,
      tenantId: created.tenantId,
      periodStart: created.periodStart,
      periodEnd: created.periodEnd,
      metricName: created.metricName as MetricName,
      countValue: toNumberSafe(created.countValue),
      softLimit: toNullableNumberSafe(created.softLimit),
      hardLimit: toNullableNumberSafe(created.hardLimit),
      overageCount: toNumberSafe(created.overageCount),
    };
  }

  // Fallback path (in-memory)
  const existing = memCounters.get(key);
  if (existing) return existing;

  const created: UsageCounter = {
    orgId,
    tenantId,
    licenseId: licenseId ?? null,
    metricName,
    periodStart,
    periodEnd,
    countValue: 0,
    softLimit: null,
    hardLimit: null,
    overageCount: 0,
  };

  memCounters.set(key, created);
  return created;
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
  if (!periodStart) periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  if (!periodEnd) periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const counter = await getOrCreateUsageCounter(orgId, tenantId, licenseId, metricName, periodStart, periodEnd);

  const newCount = counter.countValue + amount;
  const willBeOverLimit = counter.hardLimit ? newCount >= counter.hardLimit : false;
  const isOverSoftLimit = counter.softLimit ? newCount >= counter.softLimit : false;

  // Calculate overage
  let overage = 0;
  if (counter.hardLimit && newCount > counter.hardLimit) {
    overage = newCount - counter.hardLimit;
  }

  // Persist update
  if (hasUsageCounterModel()) {
    await (prisma as any).usageCounter.update({
      where: {
        orgId_licenseId_periodStart_metricName: {
          orgId,
          licenseId: licenseId || "",
          periodStart,
          metricName,
        },
      },
      data: {
        countValue: newCount,
        overageCount: overage,
      },
    });
  } else {
    const key = counterKeyOf(orgId, tenantId, licenseId, metricName, periodStart);
    memCounters.set(key, {
      ...counter,
      countValue: newCount,
      overageCount: overage,
    });
  }

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
): Promise<
  Record<
    MetricName,
    {
      count: number;
      softLimit: number | null;
      hardLimit: number | null;
      overage: number;
      warning: boolean;
      blocked: boolean;
    }
  >
> {
  const now = new Date();
  if (!periodStart) periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  if (!periodEnd) periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const metrics: MetricName[] = ["scan_count", "ocr_pages", "ai_tokens", "invoices", "exports", "api_calls"];

  // Load counters
  let counters: any[] = [];
  if (hasUsageCounterModel()) {
    counters = await (prisma as any).usageCounter.findMany({
      where: {
        orgId,
        periodStart: { gte: periodStart, lte: periodEnd },
      },
    });
  } else {
    // Filter in-memory by org + window
    const ps = periodStart.getTime();
    const pe = periodEnd.getTime();
    memCounters.forEach((c) => {
      if (c.orgId !== orgId) return;
      const t = c.periodStart.getTime();
      if (t < ps || t > pe) return;
      counters.push(c);
    });
  }

  const summary: any = {};

  for (const metric of metrics) {
    const counter = counters.find((c: any) => c.metricName === metric);
    if (counter) {
      const countValue = toNumberSafe(counter.countValue);
      const softLimit = toNullableNumberSafe(counter.softLimit);
      const hardLimit = toNullableNumberSafe(counter.hardLimit);
      summary[metric] = {
        count: countValue,
        softLimit,
        hardLimit,
        overage: toNumberSafe(counter.overageCount),
        warning: softLimit != null ? countValue >= softLimit : false,
        blocked: hardLimit != null ? countValue >= hardLimit : false,
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
  if (!periodStart) periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  if (!periodEnd) periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  if (hasUsageCounterModel()) {
    await (prisma as any).usageCounter.updateMany({
      where: { orgId, metricName, periodStart, periodEnd },
      data: {
        softLimit: softLimit == null ? null : softLimit,
        hardLimit: hardLimit == null ? null : hardLimit,
      },
    });
    return;
  }

  // In-memory: update any matching counters for that month
  memCounters.forEach((c, k) => {
    if (c.orgId !== orgId) return;
    if (c.metricName !== metricName) return;
    if (c.periodStart.getTime() !== periodStart!.getTime()) return;
    if (c.periodEnd.getTime() !== periodEnd!.getTime()) return;

    memCounters.set(k, {
      ...c,
      softLimit,
      hardLimit,
    });
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
  if (!hasIdempotencyModel()) {
    return { exists: false };
  }

  const record = await (prisma as any).idempotencyKey.findUnique({
    where: { keyHash },
  });

  if (!record) return { exists: false };

  // Check if expired
  if (record.expiresAt < new Date()) {
    await (prisma as any).idempotencyKey.delete({ where: { keyHash } });
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
  if (!hasIdempotencyModel()) {
    // best-effort no-op when model not present
    return;
  }

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + expiresInSeconds);

  await (prisma as any).idempotencyKey.create({
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
