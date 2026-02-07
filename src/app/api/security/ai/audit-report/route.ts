// AI Security Audit & Reporting API
// POST /api/security/ai/audit-report

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { generateSecurityAudit } from "@/lib/ai/security-audit";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { auditType } = body;

    const tenantId = user.tenantId || "default";

    // Generate audit
    const audit = await generateSecurityAudit(
      tenantId,
      auditType || "ON_DEMAND"
    );

    // Save audit
    const savedAudit = await prisma.aISecurityAudit.create({
      data: {
        tenantId,
        auditDate: new Date(),
        auditType: auditType || "ON_DEMAND",
        overallScore: audit.overallScore,
        previousScore: audit.previousScore || null,
        scoreChange: audit.scoreChange || null,
        vulnerabilitiesFound: audit.vulnerabilitiesFound,
        vulnerabilities: audit.vulnerabilities
          ? JSON.parse(JSON.stringify(audit.vulnerabilities))
          : null,
        complianceGaps: audit.complianceGaps
          ? JSON.parse(JSON.stringify(audit.complianceGaps))
          : null,
        complianceScore: audit.complianceScore || null,
        trends: audit.trends
          ? JSON.parse(JSON.stringify(audit.trends))
          : null,
        recommendations: audit.recommendations
          ? JSON.parse(JSON.stringify(audit.recommendations))
          : null,
      },
    });

    return NextResponse.json({
      success: true,
      audit: {
        id: savedAudit.id,
        overallScore: audit.overallScore,
        previousScore: audit.previousScore,
        scoreChange: audit.scoreChange,
        vulnerabilitiesFound: audit.vulnerabilitiesFound,
        vulnerabilities: audit.vulnerabilities,
        complianceGaps: audit.complianceGaps,
        complianceScore: audit.complianceScore,
        trends: audit.trends,
        recommendations: audit.recommendations,
      },
    });
  } catch (error: any) {
    console.error("Security audit API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/security/ai/audit-report - Get audit history
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const auditType = searchParams.get("auditType");
    const limit = parseInt(searchParams.get("limit") || "10");

    const where: any = { tenantId };
    if (auditType) {
      where.auditType = auditType;
    }

    const audits = await prisma.aISecurityAudit.findMany({
      where,
      orderBy: {
        auditDate: "desc",
      },
      take: limit,
    });

    return NextResponse.json({
      audits: audits.map((a) => ({
        id: a.id,
        auditDate: a.auditDate,
        auditType: a.auditType,
        overallScore: a.overallScore,
        previousScore: a.previousScore,
        scoreChange: a.scoreChange,
        vulnerabilitiesFound: a.vulnerabilitiesFound,
        complianceScore: a.complianceScore,
      })),
    });
  } catch (error: any) {
    console.error("Get security audits API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
