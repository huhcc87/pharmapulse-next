/**
 * Analytics Summary API
 * 
 * GET /api/analytics/summary?range=last_30_days
 * 
 * Requires: ANALYTICS_VIEW permission
 * Revenue requires: ANALYTICS_VIEW_REVENUE permission
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { requireAnalyticsPermission, hasAnalyticsPermission } from "@/lib/security/analytics-permissions";
import { verifyAnalyticsUnlockToken } from "@/lib/security/analytics-stepup";
import { logAnalyticsAudit } from "@/lib/audit/analytics-audit";
import { prisma } from "@/lib/prisma";
import { extractClientIP } from "@/lib/licensing/ip-extraction";

const MAX_DATE_RANGE_DAYS = 365;
const CACHE_TTL_SECONDS = 300; // 5 minutes

// Simple in-memory cache (use Redis in production)
const cache = new Map<string, { data: any; expiresAt: number }>();

function getCacheKey(tenantId: string, range: string): string {
  return `analytics:summary:${tenantId}:${range}`;
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
 * Get date range from query parameter
 */
function getDateRange(range: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (range) {
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setDate(start.getDate() - 30);
      break;
    case 'quarter':
      start.setDate(start.getDate() - 90);
      break;
    case 'year':
      start.setDate(start.getDate() - 365);
      break;
    case 'last_30_days':
      start.setDate(start.getDate() - 30);
      break;
    default:
      start.setDate(start.getDate() - 30);
  }

  // Enforce max range
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > MAX_DATE_RANGE_DAYS) {
    start.setDate(end.getDate() - MAX_DATE_RANGE_DAYS);
  }

  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    // Check analytics permission
    await requireAnalyticsPermission(user.tenantId, user.userId, 'ANALYTICS_VIEW');

    // Check analytics unlock token (step-up auth)
    const unlockToken = request.headers.get('x-analytics-unlock-token');
    if (!unlockToken) {
      return NextResponse.json(
        { error: 'Analytics unlock token required. Please complete step-up authentication.' },
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
    const range = searchParams.get('range') || 'last_30_days';
    const { start, end } = getDateRange(range);

    // Check cache
    const cacheKey = getCacheKey(user.tenantId, range);
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Check revenue permission
    const canViewRevenue = await hasAnalyticsPermission(user.tenantId, user.userId, 'ANALYTICS_VIEW_REVENUE');

    // Get orgId from tenant (assuming tenantId = orgId for now)
    const orgId = user.tenantId;

    // Query analytics data (scoped to orgId from auth context)
    // Note: Adapt these queries to your actual schema
    const [totalRevenue, totalSales, productsSold, activeCustomers] = await Promise.all([
      // Total Revenue (only if permission granted)
      canViewRevenue
        ? prisma.$queryRaw<Array<{ total: number }>>`
            SELECT COALESCE(SUM(grand_total), 0) as total
            FROM invoices
            WHERE tenant_id = ${orgId}
              AND created_at >= ${start}
              AND created_at <= ${end}
              AND status = 'ISSUED'
          `.then(r => Number(r[0]?.total || 0))
        : Promise.resolve(null),
      
      // Total Sales Count
      prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int as count
        FROM invoices
        WHERE tenant_id = ${orgId}
          AND created_at >= ${start}
          AND created_at <= ${end}
          AND status = 'ISSUED'
      `.then(r => Number(r[0]?.count || 0)),
      
      // Products Sold (quantity)
      prisma.$queryRaw<Array<{ total: number }>>`
        SELECT COALESCE(SUM(quantity), 0) as total
        FROM invoice_line_items ili
        INNER JOIN invoices i ON ili.invoice_id = i.id
        WHERE i.tenant_id = ${orgId}
          AND i.created_at >= ${start}
          AND i.created_at <= ${end}
          AND i.status = 'ISSUED'
      `.then(r => Number(r[0]?.total || 0)),
      
      // Active Customers
      prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(DISTINCT buyer_name)::int as count
        FROM invoices
        WHERE tenant_id = ${orgId}
          AND created_at >= ${start}
          AND created_at <= ${end}
          AND status = 'ISSUED'
          AND buyer_name IS NOT NULL
      `.then(r => Number(r[0]?.count || 0)),
    ]);

    const result = {
      range,
      period: { start, end },
      metrics: {
        totalRevenue: canViewRevenue ? totalRevenue : null,
        totalSales,
        productsSold,
        activeCustomers,
      },
      canViewRevenue,
    };

    // Cache result
    setCache(cacheKey, result);

    // Log audit
    await logAnalyticsAudit(
      user.tenantId,
      user.userId,
      'ANALYTICS_PAGE_VIEWED',
      { range, metrics: Object.keys(result.metrics) },
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
    console.error('Analytics summary error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics summary' },
      { status: 500 }
    );
  }
}
