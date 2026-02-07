/**
 * Auth Setup API (Development Helper)
 * 
 * Sets authentication cookies for development/testing
 * 
 * WARNING: This should be disabled or restricted in production!
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

const setupSchema = z.object({
  tenantId: z.string(),
  userId: z.string(),
  email: z.string().email().optional(),
  role: z.string().optional(),
});

// POST /api/auth/setup - Set auth cookies (development only)
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { tenantId, userId, email = "admin@pharmapulse.com", role = "owner" } = setupSchema.parse(body);

    const c = await cookies();

    // Set cookies
    c.set("pp_tenant", tenantId, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
    });
    c.set("pp_user", userId, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
    });
    c.set("pp_email", email, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
    });
    c.set("pp_role", role, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
    });

    return NextResponse.json({
      success: true,
      message: "Auth cookies set successfully",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to setup auth" },
      { status: 500 }
    );
  }
}
