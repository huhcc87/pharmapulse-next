/**
 * Maker-Checker Pending Actions API
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserWithPermissions } from "@/lib/security/rbac";
import {
  getPendingActions,
  approvePendingAction,
  rejectPendingAction,
} from "@/lib/security/maker-checker";
import { z } from "zod";

const approveSchema = z.object({
  actionId: z.string(),
});

const rejectSchema = z.object({
  actionId: z.string(),
  reason: z.string(),
});

// GET /api/security/pending-actions - Get pending actions
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserWithPermissions();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as any;
    const actionType = searchParams.get("actionType") || undefined;
    const createdBy = searchParams.get("createdBy") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const result = await getPendingActions(user.tenantId, {
      status,
      actionType,
      createdBy,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to get pending actions" },
      { status: error.status || 500 }
    );
  }
}

// POST /api/security/pending-actions/approve - Approve pending action
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserWithPermissions();
    const body = await request.json();
    const { actionId } = approveSchema.parse(body);

    await approvePendingAction(user.tenantId, actionId, user.userId);

    return NextResponse.json({
      success: true,
      message: "Action approved",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to approve action" },
      { status: error.status || 500 }
    );
  }
}

// POST /api/security/pending-actions/reject - Reject pending action
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserWithPermissions();
    const body = await request.json();
    const { actionId, reason } = rejectSchema.parse(body);

    await rejectPendingAction(user.tenantId, actionId, user.userId, reason);

    return NextResponse.json({
      success: true,
      message: "Action rejected",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to reject action" },
      { status: error.status || 500 }
    );
  }
}
