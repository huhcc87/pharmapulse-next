/**
 * RBAC Management API
 * 
 * Endpoints for managing roles and permissions
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserWithPermissions, assignRoleToUser, removeRoleFromUser } from "@/lib/security/rbac";
import { z } from "zod";

const assignRoleSchema = z.object({
  targetUserId: z.string(),
  roleName: z.enum(["OWNER", "ADMIN", "PHARMACIST", "CASHIER", "INVENTORY", "AUDITOR"]),
});

// GET /api/security/rbac - Get current user's roles and permissions
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserWithPermissions();
    return NextResponse.json({
      userId: user.userId,
      tenantId: user.tenantId,
      roles: user.roles,
      permissions: user.permissions,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to get RBAC info" },
      { status: error.status || 500 }
    );
  }
}

// POST /api/security/rbac/assign - Assign role to user
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserWithPermissions();
    const body = await request.json();
    const { targetUserId, roleName } = assignRoleSchema.parse(body);

    await assignRoleToUser(user.tenantId, targetUserId, roleName, user.userId);

    return NextResponse.json({
      success: true,
      message: `Role ${roleName} assigned to user ${targetUserId}`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to assign role" },
      { status: error.status || 500 }
    );
  }
}

// DELETE /api/security/rbac/remove - Remove role from user
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserWithPermissions();
    const body = await request.json();
    const { targetUserId, roleName } = assignRoleSchema.parse(body);

    await removeRoleFromUser(user.tenantId, targetUserId, roleName, user.userId);

    return NextResponse.json({
      success: true,
      message: `Role ${roleName} removed from user ${targetUserId}`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to remove role" },
      { status: error.status || 500 }
    );
  }
}
