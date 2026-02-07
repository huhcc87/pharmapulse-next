/**
 * Step-up Authentication API
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { verifyStepUpAuth, hasValidStepUpSession } from "@/lib/security/step-up-auth";
import { StepUpMethod } from "@prisma/client";
import { z } from "zod";

const verifySchema = z.object({
  method: z.enum(["PASSWORD", "TOTP", "MAGIC_LINK"]),
  // Add method-specific fields as needed
  password: z.string().optional(),
  totpCode: z.string().optional(),
  token: z.string().optional(),
});

// POST /api/security/step-up/verify - Verify step-up auth
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await request.json();
    const { method } = verifySchema.parse(body);

    // TODO: Implement actual verification based on method
    // For now, we'll create a session if method is provided
    const result = await verifyStepUpAuth(
      user.tenantId,
      user.userId,
      method as StepUpMethod,
      request
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Verification failed" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      expiresIn: 600, // 10 minutes in seconds
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to verify step-up auth" },
      { status: error.status || 500 }
    );
  }
}

// GET /api/security/step-up/status - Check if step-up session is valid
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const hasSession = await hasValidStepUpSession(user.tenantId, user.userId);

    return NextResponse.json({
      hasValidSession: hasSession,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to check step-up status" },
      { status: error.status || 500 }
    );
  }
}
