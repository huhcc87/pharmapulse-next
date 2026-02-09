// src/lib/ai/security-audit.ts
// AI Security Audit & Reporting
// Automated security reports, vulnerability detection, compliance gap analysis

import { prisma } from "@/lib/prisma";

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SecurityAuditResult {
  overallScore: number; // 0-100
  previousScore?: number;
  scoreChange?: number;

  vulnerabilitiesFound: number;
  vulnerabilities?: Array<{
    type: string;
    severity: Severity;
    description: string;
    recommendation: string;
  }>;

  complianceGaps?: Array<{
    standard: string; // GDPR, HIPAA, etc.
    gap: string;
    severity: string;
  }>;

  complianceScore?: number;

  trends?: {
    direction: "IMPROVING" | "DECLINING" | "STABLE";
    change: number;
  };

  recommendations?: Array<{
    priority: "HIGH" | "MEDIUM" | "LOW";
    action: string;
    impact: string;
  }>;
}

type Vulnerability = NonNullable<SecurityAuditResult["vulnerabilities"]>[number];
type ComplianceGap = NonNullable<SecurityAuditResult["complianceGaps"]>[number];
type Recommendation = NonNullable<SecurityAuditResult["recommendations"]>[number];

function toTenantInt(tenantId: string | number | undefined, fallback = 1): number {
  if (typeof tenantId === "number" && Number.isFinite(tenantId)) return tenantId;
  const n = typeof tenantId === "string" ? Number.parseInt(tenantId, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Generate security audit report
 */
export async function generateSecurityAudit(
  tenantId: string,
  auditType: "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ON_DEMAND" = "ON_DEMAND"
): Promise<SecurityAuditResult> {
  const tenantInt = toTenantInt(tenantId, 1);

  try {
    const result: SecurityAuditResult = {
      overallScore: 100,
      vulnerabilitiesFound: 0,
      vulnerabilities: [],
      complianceGaps: [],
      recommendations: [],
    };

    // 1) Get previous audit for comparison
    const previousAudit = await prisma.aISecurityAudit.findFirst({
      where: {
        tenantId, // keeping string because your AI audit model appears to store tenantId as string
        auditType,
      },
      orderBy: { auditDate: "desc" },
    });

    if (previousAudit) {
      result.previousScore = Number(previousAudit.overallScore);
    }

    // 2) Detect vulnerabilities (ALWAYS returns [])
    const vulnerabilities = await detectVulnerabilities(tenantId, tenantInt);
    result.vulnerabilities = vulnerabilities;
    result.vulnerabilitiesFound = vulnerabilities.length;

    // Deduct score for vulnerabilities
    for (const vuln of vulnerabilities) {
      if (vuln.severity === "CRITICAL") result.overallScore -= 20;
      else if (vuln.severity === "HIGH") result.overallScore -= 10;
      else if (vuln.severity === "MEDIUM") result.overallScore -= 5;
      else result.overallScore -= 2;
    }

    // 3) Compliance gap analysis (ALWAYS returns [])
    const complianceGaps = await analyzeComplianceGaps(tenantId, tenantInt);
    result.complianceGaps = complianceGaps;

    const complianceScore = 100 - complianceGaps.length * 10;
    result.complianceScore = Math.max(0, complianceScore);

    // 4) Security trends
    if (previousAudit && typeof result.previousScore === "number") {
      const change = result.overallScore - result.previousScore;
      result.scoreChange = change;
      result.trends = {
        direction: change > 5 ? "IMPROVING" : change < -5 ? "DECLINING" : "STABLE",
        change,
      };
    }

    // 5) Recommendations
    result.recommendations = generateRecommendations(result);

    // clamp 0..100
    result.overallScore = Math.max(0, Math.min(100, result.overallScore));

    return result;
  } catch (error: any) {
    console.error("Security audit generation error:", error);
    throw error;
  }
}

/**
 * Detect vulnerabilities
 *
 * IMPORTANT FIX:
 * Your Prisma User model does NOT have tenantId (error: tenantId does not exist on UserWhereInput).
 * So we DO NOT filter users by tenantId here.
 * If you later add org/store scoping (e.g., storeId, orgId, pharmacyId), filter by that instead.
 */
async function detectVulnerabilities(
  tenantIdString: string,
  tenantInt: number
): Promise<Vulnerability[]> {
  const vulnerabilities: Vulnerability[] = [];

  // 1) Sample users (no tenant filter, because field doesn't exist)
  const sampleUsers = await prisma.user.findMany({
    take: 10,
    select: { id: true },
  });

  const totalUsers = sampleUsers.length;

  // 2) MFA adoption
  // (Your mfaSecret model appears to have tenantId as STRING based on earlier usage.)
  const usersWithMFA = await prisma.mfaSecret.count({
    where: {
      tenantId: tenantIdString,
      isEnabled: true,
    },
  });

  const mfaAdoptionRate = totalUsers > 0 ? (usersWithMFA / totalUsers) * 100 : 0;

  if (mfaAdoptionRate < 50) {
    vulnerabilities.push({
      type: "LOW_MFA_ADOPTION",
      severity: "MEDIUM",
      description: `Only ${mfaAdoptionRate.toFixed(1)}% of sampled users have MFA enabled`,
      recommendation: "Require MFA for all staff accounts (at minimum admins/cashiers)",
    });
  }

  // 3) Recent security events
  const recentCriticalEvents = await prisma.securityEvent.count({
    where: {
      tenantId: tenantIdString,
      severity: "critical",
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  if (recentCriticalEvents > 5) {
    vulnerabilities.push({
      type: "HIGH_CRITICAL_EVENTS",
      severity: "HIGH",
      description: `${recentCriticalEvents} critical security events in the last 7 days`,
      recommendation: "Investigate event sources, rotate secrets, and tighten rate limits immediately",
    });
  }

  // 4) Account lockouts
  const recentLockouts = await prisma.accountLockout.count({
    where: {
      tenantId: tenantIdString,
      lockedUntil: { gte: new Date() },
    },
  });

  if (recentLockouts > 3) {
    vulnerabilities.push({
      type: "MULTIPLE_ACCOUNT_LOCKOUTS",
      severity: "MEDIUM",
      description: `${recentLockouts} accounts currently locked`,
      recommendation: "Review lockouts for credential stuffing; enable IP throttling and MFA enforcement",
    });
  }

  return vulnerabilities;
}

/**
 * Compliance gap analysis (returns a concrete array)
 *
 * NOTE:
 * If your AuditLog model uses tenantId as INT, keep tenantInt.
 * If it uses string tenantId, change to tenantIdString.
 */
async function analyzeComplianceGaps(
  tenantIdString: string,
  tenantInt: number
): Promise<ComplianceGap[]> {
  const gaps: ComplianceGap[] = [];

  // GDPR: audit logging presence (simplified)
  const hasAuditLogs = await prisma.auditLog.count({
    // If this errors next, your AuditLog tenant field is NOT `tenantId: Int`.
    // In that case: remove tenantId filter or use tenantIdString based on your schema.
    where: {
      tenantId: tenantInt as any,
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    } as any,
  });

  if (hasAuditLogs < 10) {
    gaps.push({
      standard: "GDPR",
      gap: "Insufficient audit logging (low volume in last 30 days)",
      severity: "MEDIUM",
    });
  }

  gaps.push({
    standard: "GDPR",
    gap: "Data retention policy not configured",
    severity: "LOW",
  });

  return gaps;
}

function generateRecommendations(audit: SecurityAuditResult): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const vulns = audit.vulnerabilities ?? [];
  const gaps = audit.complianceGaps ?? [];

  if (audit.overallScore < 70) {
    recommendations.push({
      priority: "HIGH",
      action: "Address high/critical vulnerabilities immediately",
      impact: "Reduces breach risk and improves security score quickly",
    });
  }

  if (vulns.length > 0) {
    recommendations.push({
      priority: "HIGH",
      action: "Fix identified vulnerabilities",
      impact: `Expected improvement: ~${vulns.length * 5} points (rule-of-thumb)`,
    });
  }

  if (gaps.length > 0) {
    recommendations.push({
      priority: "MEDIUM",
      action: "Close compliance gaps (logging, retention, access controls)",
      impact: "Improves compliance score and reduces regulatory exposure",
    });
  }

  if (audit.trends?.direction === "DECLINING") {
    recommendations.push({
      priority: "MEDIUM",
      action: "Review security posture (score trending down)",
      impact: "Prevents further degradation and recurring incidents",
    });
  }

  return recommendations;
}
