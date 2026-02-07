/**
 * Licence Violations API
 * 
 * Endpoints:
 * - GET: Get last N violations for current user's licence
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";

// GET /api/licensing/violations - Get last violations
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      );
    }
    
    requireAuth(user);

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "5");

    const licence = await prisma.license.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!licence) {
      return NextResponse.json(
        { error: "Licence not found" },
        { status: 404 }
      );
    }

    const violations = await prisma.licenseViolation.findMany({
      where: {
        licenceId: licence.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      select: {
        id: true,
        violationType: true,
        reason: true,
        ipAddress: true,
        deviceId: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      violations: violations.map(v => ({
        id: v.id,
        type: v.violationType,
        reason: v.reason,
        ip_address: v.ipAddress,
        device_id: v.deviceId ? "***" : null, // Mask device ID
        timestamp: v.createdAt,
        created_at: v.createdAt,
      })),
      total_violations: licence.violationCount || 0,
      last_violation_at: licence.lastViolationAt,
    });
  } catch (error: any) {
    console.error("Violations fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch violations", message: error.message },
      { status: 500 }
    );
  }
}
