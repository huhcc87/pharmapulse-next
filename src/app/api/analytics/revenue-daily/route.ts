/**
 * Revenue Daily Analytics API
 * 
 * GET /api/analytics/revenue-daily?start=YYYY-MM-DD&end=YYYY-MM-DD
 * 
 * Requires: ANALYTICS_VIEW_REVENUE permission
 * Uses Asia/Kolkata timezone for day boundaries
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { requireAnalyticsPermission } from "@/lib/security/analytics-permissions";
import { verifyAnalyticsUnlockToken } from "@/lib/security/analytics-stepup";
import { logAnalyticsAudit } from "@/lib/audit/analytics-audit";
import { prisma } from "@/lib/prisma";
import { extractClientIP } from "@/lib/licensing/ip-extraction";

const MAX_DATE_RANGE_DAYS = 365;
const CACHE_TTL_SECONDS = 300; // 5 minutes

const cache = new Map<string, { data: any; expiresAt: number }>();

function getCacheKey(tenantId: string, start: string, end: string): string {
  return `analytics:revenue-daily:${tenantId}:${start}:${end}`;
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

/**
 * Convert date to Asia/Kolkata timezone day boundary
 */
function getKolkataDayBoundary(date: Date): { start: Date; end: Date } {
  // Create date in IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istDate = new Date(date.getTime() + istOffset);
  
  // Get start of day in IST (00:00:00)
  const startOfDay = new Date(istDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  
  // Get end of day in IST (23:59:59.999)
  const endOfDay = new Date(istDate);
  endOfDay.setUTCHours(23, 59, 59, 999);
  
  // Convert back to UTC
  const start = new Date(startOfDay.getTime() - istOffset);
  const end = new Date(endOfDay.getTime() - istOffset);
  
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    // Check revenue permission
    await requireAnalyticsPermission(user.tenantId, user.userId, 'ANALYTICS_VIEW_REVENUE');

    // Check analytics unlock token
    const unlockToken = request.headers.get('x-analytics-unlock-token');
    if (!unlockToken) {
      return NextResponse.json(
        { error: 'Analytics unlock token required' },
        { status: 403 }
      );
    }

    const isValidToken = await verifyAnalyticsUnlockToken(unlockToken, user.tenantId, user.userId);
    if (!isValidToken) {
      return NextResponse.json(
        { error: 'Invalid or expired analytics unlock token' },
        { status: 403 }
      );
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    if (!startParam || !endParam) {
      return NextResponse.json(
        { error: 'start and end date parameters required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const startDate = new Date(startParam);
    const endDate = new Date(endParam);

    // Validate date range
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > MAX_DATE_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days` },
        { status: 400 }
      );
    }

    // Check cache
    const cacheKey = getCacheKey(user.tenantId, startParam, endParam);
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const orgId = user.tenantId;

    // Query daily revenue (grouped by IST day)
    // Using PostgreSQL timezone functions
    const dailyRevenue = await prisma.$queryRaw<Array<{
      date: string;
      revenue: number;
    }>>`
      SELECT 
        DATE(invoices.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::text as date,
        COALESCE(SUM(invoices.grand_total), 0) as revenue
      FROM invoices
      WHERE invoices.tenant_id = ${orgId}
        AND invoices.created_at >= ${startDate}
        AND invoices.created_at <= ${endDate}
        AND invoices.status = 'ISSUED'
      GROUP BY DATE(invoices.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')
      ORDER BY date ASC
    `;

    const labels = dailyRevenue.map(r => r.date);
    const series = dailyRevenue.map(r => Number(r.revenue));

    const result = {
      labels,
      series,
      period: { start: startParam, end: endParam },
    };

    // Cache result
    setCache(cacheKey, result);

    // Log audit
    await logAnalyticsAudit(
      user.tenantId,
      user.userId,
      'ANALYTICS_QUERY_EXECUTED',
      { query: 'revenue-daily', start: startParam, end: endParam },
      extractClientIP(request),
      request.headers.get('user-agent') || undefined
    );

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message.includes('Permission')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    console.error('Revenue daily analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue analytics' },
      { status: 500 }
    );
  }
}
