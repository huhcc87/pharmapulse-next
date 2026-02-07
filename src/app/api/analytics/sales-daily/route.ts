/**
 * Sales Daily Analytics API
 * 
 * GET /api/analytics/sales-daily?start=YYYY-MM-DD&end=YYYY-MM-DD
 * 
 * Requires: ANALYTICS_VIEW_SALES permission
 * Uses Asia/Kolkata timezone
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { requireAnalyticsPermission } from "@/lib/security/analytics-permissions";
import { verifyAnalyticsUnlockToken } from "@/lib/security/analytics-stepup";
import { logAnalyticsAudit } from "@/lib/audit/analytics-audit";
import { prisma } from "@/lib/prisma";
import { extractClientIP } from "@/lib/licensing/ip-extraction";

const MAX_DATE_RANGE_DAYS = 365;
const CACHE_TTL_SECONDS = 300;

const cache = new Map<string, { data: any; expiresAt: number }>();

function getCacheKey(tenantId: string, start: string, end: string): string {
  return `analytics:sales-daily:${tenantId}:${start}:${end}`;
}

function getCached(key: string): any | null {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    await requireAnalyticsPermission(user.tenantId, user.userId, 'ANALYTICS_VIEW_SALES');

    const unlockToken = request.headers.get('x-analytics-unlock-token');
    if (!unlockToken) {
      return NextResponse.json({ error: 'Analytics unlock token required' }, { status: 403 });
    }

    const isValidToken = await verifyAnalyticsUnlockToken(unlockToken, user.tenantId, user.userId);
    if (!isValidToken) {
      return NextResponse.json({ error: 'Invalid or expired analytics unlock token' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    if (!startParam || !endParam) {
      return NextResponse.json({ error: 'start and end date parameters required' }, { status: 400 });
    }

    const startDate = new Date(startParam);
    const endDate = new Date(endParam);

    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > MAX_DATE_RANGE_DAYS) {
      return NextResponse.json({ error: `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days` }, { status: 400 });
    }

    const cacheKey = getCacheKey(user.tenantId, startParam, endParam);
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const orgId = user.tenantId;

    // Query daily sales count
    const dailySales = await prisma.$queryRaw<Array<{
      date: string;
      count: number;
    }>>`
      SELECT 
        DATE(invoices.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::text as date,
        COUNT(*)::int as count
      FROM invoices
      WHERE invoices.tenant_id = ${orgId}
        AND invoices.created_at >= ${startDate}
        AND invoices.created_at <= ${endDate}
        AND invoices.status = 'ISSUED'
      GROUP BY DATE(invoices.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')
      ORDER BY date ASC
    `;

    const labels = dailySales.map(r => r.date);
    const series = dailySales.map(r => Number(r.count));

    const result = {
      labels,
      series,
      period: { start: startParam, end: endParam },
    };

    setCache(cacheKey, result);

    await logAnalyticsAudit(
      user.tenantId,
      user.userId,
      'ANALYTICS_QUERY_EXECUTED',
      { query: 'sales-daily', start: startParam, end: endParam },
      extractClientIP(request),
      request.headers.get('user-agent') || undefined
    );

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message.includes('Permission')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Sales daily analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch sales analytics' }, { status: 500 });
  }
}
