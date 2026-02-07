/**
 * Get Organization Users API (Owner Only)
 * 
 * GET /api/admin/org/users
 * Returns list of users with their analytics permissions
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { requireRole } from "@/lib/security/rbac";
import { getUsersWithAnalyticsPermissions } from "@/lib/security/analytics-permissions";

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    // Only OWNER can view users
    await requireRole(user.userId, user.tenantId, 'OWNER');

    const users = await getUsersWithAnalyticsPermissions(user.tenantId);

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error: any) {
    if (error.message.includes('Forbidden') || error.message.includes('OWNER')) {
      return NextResponse.json(
        { error: 'Only Owner can view users' },
        { status: 403 }
      );
    }
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Failed to get users' },
      { status: 500 }
    );
  }
}
