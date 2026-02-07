/**
 * Revoke Analytics Permission API (Owner Only)
 * 
 * POST /api/admin/permissions/revoke
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { requireRole } from "@/lib/security/rbac";
import { revokeAnalyticsPermission } from "@/lib/security/analytics-permissions";
import { logAnalyticsAudit } from "@/lib/audit/analytics-audit";
import { extractClientIP } from "@/lib/licensing/ip-extraction";
import { z } from "zod";

const revokeSchema = z.object({
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

    // Only OWNER can revoke permissions
    await requireRole(user.userId, user.tenantId, 'OWNER');

    const body = await request.json();
    const { userId, permission } = revokeSchema.parse(body);

    await revokeAnalyticsPermission(
      user.tenantId,
      userId,
      permission,
      user.userId
    );

    // Log audit
    await logAnalyticsAudit(
      user.tenantId,
      user.userId,
      'ANALYTICS_PERMISSION_REVOKED',
      {
        targetUserId: userId,
        permission,
      },
      extractClientIP(request) || undefined,
      request.headers.get('user-agent') || undefined
    );

    return NextResponse.json({
      success: true,
      message: `Permission ${permission} revoked from user ${userId}`,
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
        { error: 'Only Owner can revoke permissions' },
        { status: 403 }
      );
    }
    console.error('Revoke permission error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to revoke permission' },
      { status: 500 }
    );
  }
}
