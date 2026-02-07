/**
 * Support Mode API
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import {
  enableSupportMode,
  isSupportModeActive,
  revokeSupportMode,
} from "@/lib/security/support-mode";
import { SupportSessionScope } from "@prisma/client";
import { z } from "zod";

const enableSchema = z.object({
  scope: z.enum(["READ_ONLY", "DIAGNOSTICS"]).optional(),
  durationMinutes: z.number().optional(),
});

// POST /api/security/support/enable - Enable support mode
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await request.json();
    const { scope, durationMinutes } = enableSchema.parse(body);

    const result = await enableSupportMode(
      user.tenantId,
      user.userId,
      (scope as SupportSessionScope) || "READ_ONLY",
      durationMinutes
    );

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      expiresAt: result.expiresAt,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to enable support mode" },
      { status: error.status || 500 }
    );
  }
}

// GET /api/security/support/status - Get support mode status
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const status = await isSupportModeActive(user.tenantId);

    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to get support status" },
      { status: error.status || 500 }
    );
  }
}

// DELETE /api/security/support - Revoke support mode
export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    await revokeSupportMode(user.tenantId, user.userId);

    return NextResponse.json({
      success: true,
      message: "Support mode revoked",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to revoke support mode" },
      { status: error.status || 500 }
    );
  }
}
