/**
 * License Audit Log API
 * 
 * GET: Get audit logs for license enforcement
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";

// GET /api/licensing/audit - Get audit logs
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { 
          error: "UNAUTHORIZED",
          message: "Authentication required. Please ensure you are logged in.",
        },
        { status: 401 }
      );
    }
    
    requireAuth(user);

    // Only owner/admin can view audit logs
    if (user.role !== "owner" && user.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only owner can view audit logs" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const action = searchParams.get("action");

    const where: any = {
      tenantId: user.tenantId,
    };

    if (action) {
      where.action = action;
    }

    const [logs, total] = await Promise.all([
      prisma.licenseAuditLog.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
      }),
      prisma.licenseAuditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs: logs.map(log => ({
        id: log.id,
        action: log.action,
        actorUserId: log.actorUserId,
        notes: log.notes || null,
        meta: log.meta,
        createdAt: log.createdAt,
        timestamp: log.createdAt, // Alias for compatibility
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error("Audit log error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get audit logs" },
      { status: error.status || 500 }
    );
  }
}
