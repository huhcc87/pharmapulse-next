// Zero Trust Architecture API
// GET /api/security/zero-trust/policies - List policies
// POST /api/security/zero-trust/policies - Create policy

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { createZeroTrustPolicy, evaluateZeroTrustAccess, logZeroTrustAccess } from "@/lib/security/zero-trust";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";

    const policies = await prisma.zeroTrustPolicy.findMany({
      where: {
        tenantId,
      },
      orderBy: [
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({
      policies: policies.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        resourcePattern: p.resourcePattern,
        action: p.action,
        priority: p.priority,
        isActive: p.isActive,
        createdAt: p.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Get zero trust policies API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const tenantId = user.tenantId || "default";

    const policy = await createZeroTrustPolicy(tenantId, body);

    return NextResponse.json({
      success: true,
      policy: {
        id: policy.id,
        name: policy.name,
        action: policy.action,
        priority: policy.priority,
      },
    });
  } catch (error: any) {
    console.error("Create zero trust policy API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/security/zero-trust/evaluate - Evaluate access
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { resource, method, ipAddress, deviceId, deviceTrustScore, mfaVerified, geoLocation } = body;

    if (!resource || !method) {
      return NextResponse.json(
        { error: "resource and method are required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";

    // Evaluate access
    const decision = await evaluateZeroTrustAccess(tenantId, {
      userId: user.userId || user.email,
      userRole: user.role,
      resource,
      method,
      ipAddress,
      deviceId,
      deviceTrustScore,
      mfaVerified,
      geoLocation,
    });

    // Log access
    await logZeroTrustAccess(tenantId, {
      userId: user.userId || user.email,
      resource,
      method,
      ipAddress: ipAddress || req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
      deviceId,
      decision: decision.decision,
      reason: decision.reason,
      policyId: decision.policyId,
      policyName: decision.policyName,
      mfaVerified,
      deviceTrustScore,
      geoLocation,
    });

    return NextResponse.json({
      decision,
    });
  } catch (error: any) {
    console.error("Evaluate zero trust access API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
