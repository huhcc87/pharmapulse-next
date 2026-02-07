// POST /api/offline/issue-token
// Issue offline entitlement token for device

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { generateOfflineToken } from "@/lib/offline/token";

function generateTokenId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

const DEFAULT_EXPIRY_HOURS = 24;
const DEFAULT_MAX_INVOICES = 200;

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const userId = parseInt(user.userId) || 1;
    const role = user.role as string;
    const tenantId = parseInt(user.tenantId) || 1;

    // Check if user has permission (Owner/Super Admin only)
    // Map auth roles to POS roles: "owner" | "super_admin" -> "OWNER"
    const posRole = role === "owner" || role === "super_admin" ? "OWNER" : role.toUpperCase();
    if (posRole !== "OWNER") {
      return NextResponse.json(
        { error: "Only Owner/Admin can issue offline tokens" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { deviceId, expiryHours, maxOfflineInvoices } = body;

    if (!deviceId) {
      return NextResponse.json(
        { error: "deviceId is required" },
        { status: 400 }
      );
    }

    // Check active subscription (stub - implement actual check)
    // const subscription = await checkSubscription(tenantId);
    // if (!subscription || subscription.status !== "ACTIVE") {
    //   return NextResponse.json(
    //     { error: "Active subscription required for offline mode" },
    //     { status: 403 }
    //   );
    // }

    const tokenId = generateTokenId();
    const expiresAt = Math.floor(
      (Date.now() + (expiryHours || DEFAULT_EXPIRY_HOURS) * 60 * 60 * 1000) / 1000
    );
    const issuedAt = Math.floor(Date.now() / 1000);

    // Create token record in DB
    const tokenRecord = await prisma.offlineEntitlementToken.create({
      data: {
        tenantId,
        deviceId,
        tokenId,
        status: "ACTIVE",
        issuedAt: new Date(issuedAt * 1000),
        expiresAt: new Date(expiresAt * 1000),
        maxOfflineInvoices: maxOfflineInvoices || DEFAULT_MAX_INVOICES,
        permissionsSnapshot: {
          role,
          userId,
          canIssueInvoices: true,
          canDispenseScheduleDrugs: role === "PHARMACIST" || role === "OWNER" || role === "ADMIN",
        },
      },
    });

    // Generate signed token
    const token = generateOfflineToken({
      tenantId,
      deviceId,
      tokenId,
      expiresAt,
      maxOfflineInvoices: tokenRecord.maxOfflineInvoices,
      permissions: tokenRecord.permissionsSnapshot as any,
    });

    // Audit log
    await prisma.syncAuditLog.create({
      data: {
        tenantId,
        deviceId,
        tokenId,
        action: "TOKEN_ISSUED",
        itemsProcessed: 0,
        itemsSucceeded: 0,
        itemsFailed: 0,
        details: {
          issuedBy: userId,
          role,
          expiryHours: expiryHours || DEFAULT_EXPIRY_HOURS,
          maxOfflineInvoices: tokenRecord.maxOfflineInvoices,
        },
      },
    });

    return NextResponse.json({
      token,
      tokenId,
      expiresAt,
      maxOfflineInvoices: tokenRecord.maxOfflineInvoices,
      issuedAt,
    });
  } catch (error: any) {
    console.error("Issue offline token error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to issue offline token" },
      { status: 500 }
    );
  }
}
