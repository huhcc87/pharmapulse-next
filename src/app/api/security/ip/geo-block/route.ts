// Geo-Blocking API
// GET /api/security/ip/geo-block - List geo-blocking rules
// POST /api/security/ip/geo-block - Create geo-blocking rule
// POST /api/security/ip/geo-block/check - Check if country is blocked

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { createGeoBlockingRule, checkGeoBlocking } from "@/lib/security/ip-geo-blocking";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";

    const rules = await prisma.geoBlockingRule.findMany({
      where: {
        tenantId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      rules: rules.map((r) => ({
        id: r.id,
        countryCode: r.countryCode,
        countryName: r.countryName,
        action: r.action,
        reason: r.reason,
        isActive: r.isActive,
        createdAt: r.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Get geo-blocking rules API error:", error);
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
    const { action, countryCode, countryName, reason } = body;

    if (!action || !countryCode || !countryName) {
      return NextResponse.json(
        { error: "action, countryCode, and countryName are required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";

    // Check if this is a check request
    if (action === "CHECK") {
      const result = await checkGeoBlocking(tenantId, countryCode);
      return NextResponse.json({
        blocked: result.blocked,
        action: result.action,
        reason: result.reason,
      });
    }

    // Create rule
    const rule = await createGeoBlockingRule(tenantId, {
      countryCode,
      countryName,
      action,
      reason,
    });

    return NextResponse.json({
      success: true,
      rule: {
        id: rule.id,
        countryCode: rule.countryCode,
        countryName: rule.countryName,
        action: rule.action,
      },
    });
  } catch (error: any) {
    console.error("Geo-blocking API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
