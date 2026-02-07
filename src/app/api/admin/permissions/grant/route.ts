/**
 * Grant Analytics Permission API (Owner Only)
 * 
 * POST /api/admin/permissions/grant
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { requireRole } from "@/lib/security/rbac";
import { grantAnalyticsPermission } from "@/lib/security/analytics-permissions";
import { logAnalyticsAudit } from "@/lib/audit/analytics-audit";
import { extractClientIP } from "@/lib/licensing/ip-extraction";
import { z } from "zod";

const grantSchema = z.object({
  userId: z.string(),
  permission: z.enum([
    'ANALYTICS_VIEW',
    'ANALYTICS_VIEW_REVENUE',
    'ANALYTICS_VIEW_SALES',
    'ANALYTICS_VIEW_PRODUCTS',
    'ANALYTICS_EXPORT',
  ]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    // Only OWNER can grant permissions
    await requireRole(user.userId, user.tenantId, 'OWNER');

    const body = await request.json();
    const { userId, permission } = grantSchema.parse(body);

    await grantAnalyticsPermission(
      user.tenantId,
      userId,
      permission,
      user.userId
    );

    // Log audit
    await logAnalyticsAudit(
      user.tenantId,
      user.userId,
      'ANALYTICS_PERMISSION_GRANTED',
      {
        targetUserId: userId,
        permission,
      },
      extractClientIP(request) || undefined,
      request.headers.get('user-agent') || undefined
    );

    return NextResponse.json({
      success: true,
      message: `Permission ${permission} granted to user ${userId}`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    if (error.message.includes('Forbidden') || error.message.includes('OWNER')) {
      return NextResponse.json(
        { error: 'Only Owner can grant permissions' },
        { status: 403 }
      );
    }
    console.error('Grant permission error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to grant permission' },
      { status: 500 }
    );
  }
}
