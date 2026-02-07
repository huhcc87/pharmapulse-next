import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import { validateLicenceAtLogin } from "@/lib/licensing/licence-validation";
import { extractClientIP } from "@/lib/licensing/ip-extraction";
import { getOrCreateDeviceId } from "@/lib/licensing/device-id";
import { generateDeviceFingerprintFromHeaders } from "@/lib/licensing/licence-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Get or create tenant for user
    let tenant = await prisma.tenant.findFirst({
      orderBy: { createdAt: "asc" },
    });

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: `${user.name}'s Pharmacy`,
        },
      });
    }

    // Validate licence at login (1-PC/1-IP enforcement)
    const userAgent = request.headers.get("user-agent") || "";
    const currentIP = extractClientIP(request) || "unknown";
    const deviceId = await getOrCreateDeviceId();
    const deviceFingerprint = generateDeviceFingerprintFromHeaders(userAgent, request.headers);

    const licenceValidation = await validateLicenceAtLogin({
      tenantId: tenant.id,
      userId: user.id.toString(),
      deviceId,
      deviceFingerprint,
      ipAddress: currentIP,
      userAgent,
    });

    if (!licenceValidation.allowed) {
      // Log the blocked attempt
      await prisma.licenseAuditLog.create({
        data: {
          tenantId: tenant.id,
          actorUserId: user.id.toString(),
          action: "LOGIN_BLOCKED",
          notes: licenceValidation.reason || "Licence validation failed",
          meta: {
            deviceId,
            deviceFingerprint,
            ipAddress: currentIP,
            reason: licenceValidation.reason,
          },
        },
      });

      return NextResponse.json(
        { 
          error: "LICENCE_VALIDATION_FAILED",
          message: licenceValidation.reason || "Access denied due to licence restrictions",
          redirectTo: "/settings?tab=licensing",
        },
        { status: 403 }
      );
    }

    // Set authentication cookies (matching the auth system)
    const c = await cookies();
    c.set("pp_tenant", tenant.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60, // 1 year
      path: "/",
    });
    c.set("pp_user", user.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
    });
    c.set("pp_email", user.email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
    });
    c.set("pp_role", user.role, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
    });

    return NextResponse.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Failed to login. Please try again." },
      { status: 500 }
    );
  }
}