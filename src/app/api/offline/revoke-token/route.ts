// POST /api/offline/revoke-token
// Revoke offline entitlement token

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const userId = parseInt(user.userId) || 1;
    const role = user.role as string;
    const tenantId = parseInt(user.tenantId) || 1;

    // Check if user has permission (Owner/Super Admin only)
    const posRole = role === "owner" || role === "super_admin" ? "OWNER" : role.toUpperCase();
    if (posRole !== "OWNER") {
      return NextResponse.json(
        { error: "Only Owner/Admin can revoke offline tokens" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { tokenId } = body;

    if (!tokenId) {
      return NextResponse.json(
        { error: "tokenId is required" },
        { status: 400 }
      );
    }

    // Find and revoke token
    const tokenRecord = await prisma.offlineEntitlementToken.findUnique({
      where: { tokenId },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { error: "Token not found" },
        { status: 404 }
      );
    }

    if (tokenRecord.status === "REVOKED") {
      return NextResponse.json(
        { error: "Token already revoked" },
        { status: 400 }
      );
    }

    // Revoke token
    await prisma.offlineEntitlementToken.update({
      where: { tokenId },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedBy: userId,
      },
    });

    // Audit log
    await prisma.syncAuditLog.create({
      data: {
        tenantId,
        deviceId: tokenRecord.deviceId,
        tokenId,
        action: "TOKEN_REVOKED",
        itemsProcessed: 0,
        itemsSucceeded: 0,
        itemsFailed: 0,
        details: {
          revokedBy: userId,
          role,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Token revoked successfully",
    });
  } catch (error: any) {
    console.error("Revoke offline token error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to revoke offline token" },
      { status: 500 }
    );
  }
}
