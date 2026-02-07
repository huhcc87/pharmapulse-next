// AI Threat Detection API
// GET /api/security/ai-threats - Get threat history
// POST /api/security/ai-threats - Detect threat

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { detectSecurityThreat } from "@/lib/ai/security-threat-detection";
import { prisma } from "@/lib/prisma";
import { getClientIP } from "@/lib/licensing/ip-extraction";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { userId, deviceId, userAgent, location } = body;

    const tenantId = user.tenantId || "default";
    const ipAddress = getClientIP(req) || null;

    // Detect threat
    const threat = await detectSecurityThreat(
      userId || user.userId || null,
      tenantId,
      ipAddress,
      deviceId || null,
      userAgent || req.headers.get("user-agent") || null,
      location
    );

    // Save threat detection
    const savedThreat = await prisma.aISecurityThreat.create({
      data: {
        tenantId,
        userId: userId || user.userId || null,
        threatType: threat.threatType,
        riskScore: threat.riskScore,
        severity: threat.severity,
        ipAddress: ipAddress || null,
        deviceId: deviceId || null,
        userAgent: userAgent || req.headers.get("user-agent") || null,
        location: location || null,
        isLoginAnomaly: threat.isLoginAnomaly,
        isBehavioralAnomaly: threat.isBehavioralAnomaly,
        isTimeAnomaly: threat.isTimeAnomaly,
        isLocationAnomaly: threat.isLocationAnomaly,
        autoBlocked: threat.autoBlocked,
        status: threat.autoBlocked ? "BLOCKED" : "DETECTED",
        reasoning: threat.reasoning || null,
      },
    });

    // If auto-blocked, log security event
    if (threat.autoBlocked) {
      await prisma.securityEvent.create({
        data: {
          tenantId,
          userId: userId || user.userId || null,
          eventType: "THREAT_BLOCKED",
          severity: "critical",
          ipAddress: ipAddress || null,
          deviceId: deviceId || null,
          userAgent: userAgent || req.headers.get("user-agent") || null,
          metadata: {
            threatId: savedThreat.id,
            riskScore: threat.riskScore,
            threatType: threat.threatType,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      threat: {
        id: savedThreat.id,
        threatType: threat.threatType,
        riskScore: threat.riskScore,
        severity: threat.severity,
        autoBlocked: threat.autoBlocked,
        reasoning: threat.reasoning,
      },
    });
  } catch (error: any) {
    console.error("AI threat detection API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/security/ai-threats - Get threat history
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const severity = searchParams.get("severity");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: any = {
      tenantId,
    };

    if (severity) {
      where.severity = severity;
    }

    if (status) {
      where.status = status;
    }

    const threats = await prisma.aISecurityThreat.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return NextResponse.json({
      threats: threats.map((t) => ({
        id: t.id,
        threatType: t.threatType,
        riskScore: t.riskScore,
        severity: t.severity,
        ipAddress: t.ipAddress,
        location: t.location,
        autoBlocked: t.autoBlocked,
        status: t.status,
        reasoning: t.reasoning,
        createdAt: t.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Get AI threats API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
