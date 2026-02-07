/**
 * Security Audit Logs API
 * 
 * Requires VIEW_AUDIT permission
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserWithPermissions } from "@/lib/security/rbac";
import { getAuditLogs, exportAuditLogs, verifyAuditLogIntegrity } from "@/lib/security/audit";
import { requireStepUpAuth } from "@/lib/security/step-up-auth";

// GET /api/security/audit - Get audit logs
export async function GET(request: NextRequest) {
  try {
    // Try to get user with permissions, but handle gracefully if no roles assigned
    let user;
    try {
      user = await getAuthenticatedUserWithPermissions();
    } catch (error: any) {
      // If RBAC fails, check if user is authenticated at least
      // Import auth functions with explicit types
      const authModule = await import("@/lib/auth") as {
        getSessionUser: () => Promise<any>;
        requireAuth: (user: any) => void;
      };
      const basicUser = await authModule.getSessionUser();
      if (!basicUser) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
      }
      authModule.requireAuth(basicUser);
      
      // For development: allow if user is owner/super_admin
      if (basicUser.role === "owner" || basicUser.role === "super_admin") {
        // Return empty logs with message
        return NextResponse.json({
          logs: [],
          total: 0,
          message: "No roles assigned. Please assign roles in Settings → Security.",
        });
      }
      
      return NextResponse.json(
        { error: "VIEW_AUDIT permission required" },
        { status: 403 }
      );
    }

    // Check permission
    if (!user.permissions.includes("VIEW_AUDIT")) {
      return NextResponse.json(
        { error: "VIEW_AUDIT permission required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const action = searchParams.get("action") || undefined;
    const actorUserId = searchParams.get("actorUserId") || undefined;
    const startDate = searchParams.get("startDate")
      ? new Date(searchParams.get("startDate")!)
      : undefined;
    const endDate = searchParams.get("endDate")
      ? new Date(searchParams.get("endDate")!)
      : undefined;
    const exportFormat = searchParams.get("export") as "json" | "csv" | null;

    // Export requires step-up auth
    if (exportFormat) {
      await requireStepUpAuth(user.tenantId, user.userId);
      const exportData = await exportAuditLogs(user.tenantId, {
        startDate,
        endDate,
        format: exportFormat,
      });
      return NextResponse.json(exportData);
    }

    // Regular query
    const result = await getAuditLogs(user.tenantId, {
      limit,
      offset,
      action,
      actorUserId,
      startDate,
      endDate,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to get audit logs" },
      { status: error.status || 500 }
    );
  }
}

// GET /api/security/audit/verify - Verify audit log integrity
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserWithPermissions();

    // Check permission
    if (!user.permissions.includes("VIEW_AUDIT")) {
      return NextResponse.json(
        { error: "VIEW_AUDIT permission required" },
        { status: 403 }
      );
    }

    const integrity = await verifyAuditLogIntegrity(user.tenantId);

    return NextResponse.json(integrity);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to verify integrity" },
      { status: error.status || 500 }
    );
  }
}
