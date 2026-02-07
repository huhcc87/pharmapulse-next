// Advanced MFA - Biometric API
// POST /api/security/mfa/biometric - Register biometric

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { registerBiometric } from "@/lib/security/advanced-mfa";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { biometricType, name } = body;

    if (!biometricType || !name) {
      return NextResponse.json(
        { error: "biometricType and name are required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";
    const userId = user.userId || user.email || "";

    const mfaMethod = await registerBiometric(tenantId, userId, {
      biometricType,
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
    console.error("Register biometric API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
