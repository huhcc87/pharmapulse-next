// Advanced MFA - Hardware Key (WebAuthn) API
// POST /api/security/mfa/hardware-key - Register hardware key

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { registerHardwareKey, generateBackupCodes, verifyBackupCode, getUserMfaMethods, requiresAdaptiveMfa } from "@/lib/security/advanced-mfa";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { credentialId, publicKey, name } = body;

    if (!credentialId || !publicKey || !name) {
      return NextResponse.json(
        { error: "credentialId, publicKey, and name are required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";
    const userId = user.userId || user.email || "";

    const mfaMethod = await registerHardwareKey(tenantId, userId, {
      credentialId,
      publicKey,
      name,
    });

    return NextResponse.json({
      success: true,
      mfaMethod: {
        id: mfaMethod.id,
        methodType: mfaMethod.methodType,
        name: mfaMethod.name,
      },
    });
  } catch (error: any) {
    console.error("Register hardware key API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/security/mfa/hardware-key - Get user MFA methods
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const userId = user.userId || user.email || "";

    const methods = await getUserMfaMethods(tenantId, userId);

    return NextResponse.json({
      methods,
    });
  } catch (error: any) {
    console.error("Get MFA methods API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/security/mfa/backup-codes - Generate backup codes
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { mfaMethodId, count } = body;

    if (!mfaMethodId) {
      return NextResponse.json(
        { error: "mfaMethodId is required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";
    const userId = user.userId || user.email || "";

    const codes = await generateBackupCodes(tenantId, userId, mfaMethodId, count || 10);

    return NextResponse.json({
      success: true,
      codes, // Return codes only once - user should save them
    });
  } catch (error: any) {
    console.error("Generate backup codes API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/security/mfa/adaptive - Check if adaptive MFA required
export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { ipAddress, deviceId, deviceTrustScore, location, timeOfDay } = body;

    const tenantId = user.tenantId || "default";
    const userId = user.userId || user.email || "";

    const result = await requiresAdaptiveMfa(tenantId, userId, {
      ipAddress,
      deviceId,
      deviceTrustScore,
      location,
      timeOfDay,
    });

    return NextResponse.json({
      required: result.required,
      reason: result.reason,
      method: result.method,
    });
  } catch (error: any) {
    console.error("Adaptive MFA check API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
