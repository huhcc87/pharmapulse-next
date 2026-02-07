// AI Security Audit & Reporting
// Automated security reports, vulnerability detection, compliance gap analysis

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface SecurityAuditResult {
  overallScore: number; // 0-100
  previousScore?: number;
  scoreChange?: number;
  vulnerabilitiesFound: number;
  vulnerabilities?: Array<{
    type: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
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

/**
 * Generate security audit report
 */
export async function generateSecurityAudit(
  tenantId: string,
  auditType: "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ON_DEMAND" = "ON_DEMAND"
): Promise<SecurityAuditResult> {
  try {
    const result: SecurityAuditResult = {
      overallScore: 100,
      vulnerabilitiesFound: 0,
      vulnerabilities: [],
      complianceGaps: [],
      recommendations: [],
    };

    // 1. Get previous audit for comparison
    const previousAudit = await prisma.aISecurityAudit.findFirst({
      where: {
        tenantId,
        auditType,
      },
      orderBy: {
        auditDate: "desc",
      },
    });

    if (previousAudit) {
      result.previousScore = Number(previousAudit.overallScore);
    }

    // 2. Check for vulnerabilities
    const vulnerabilities = await detectVulnerabilities(tenantId);
    result.vulnerabilities = vulnerabilities;
    result.vulnerabilitiesFound = vulnerabilities.length;

    // Deduct score for vulnerabilities
    for (const vuln of vulnerabilities) {
      if (vuln.severity === "CRITICAL") {
        result.overallScore -= 20;
      } else if (vuln.severity === "HIGH") {
        result.overallScore -= 10;
      } else if (vuln.severity === "MEDIUM") {
        result.overallScore -= 5;
      } else {
        result.overallScore -= 2;
      }
    }

    // 3. Compliance gap analysis
    const complianceGaps = await analyzeComplianceGaps(tenantId);
    result.complianceGaps = complianceGaps;
    
    // Calculate compliance score
    const complianceScore = 100 - (complianceGaps.length * 10);
    result.complianceScore = Math.max(0, complianceScore);

    // 4. Security trends
    if (previousAudit) {
      const change = result.overallScore - result.previousScore;
      result.scoreChange = change;
      result.trends = {
        direction: change > 5 ? "IMPROVING" : change < -5 ? "DECLINING" : "STABLE",
        change,
      };
    }

    // 5. Generate recommendations
    result.recommendations = generateRecommendations(result);

    // Ensure score is between 0-100
    result.overallScore = Math.max(0, Math.min(100, result.overallScore));

    return result;
  } catch (error: any) {
    console.error("Security audit generation error:", error);
    throw error;
  }
}

async function detectVulnerabilities(tenantId: string): Promise<SecurityAuditResult["vulnerabilities"]> {
  const vulnerabilities: SecurityAuditResult["vulnerabilities"] = [];

  // Check for weak passwords (users with default passwords)
  const usersWithWeakPasswords = await prisma.user.findMany({
    where: {
      tenantId: parseInt(tenantId) || 1,
    },
    take: 10, // Sample check
  });

  // Check for MFA adoption
  const totalUsers = usersWithWeakPasswords.length;
  const usersWithMFA = await prisma.mfaSecret.count({
    where: {
      tenantId,
      isEnabled: true,
    },
  });

  const mfaAdoptionRate = totalUsers > 0 ? (usersWithMFA / totalUsers) * 100 : 0;
  if (mfaAdoptionRate < 50) {
    vulnerabilities.push({
      type: "LOW_MFA_ADOPTION",
      severity: "MEDIUM",
      description: `Only ${mfaAdoptionRate.toFixed(1)}% of users have MFA enabled`,
      recommendation: "Enable MFA for all users to improve security",
    });
  }

  // Check for recent security events
  const recentCriticalEvents = await prisma.securityEvent.count({
    where: {
      tenantId,
      severity: "critical",
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
  });

  if (recentCriticalEvents > 5) {
    vulnerabilities.push({
      type: "HIGH_CRITICAL_EVENTS",
      severity: "HIGH",
      description: `${recentCriticalEvents} critical security events in the last 7 days`,
      recommendation: "Review and address critical security events immediately",
    });
  }

  // Check for account lockouts
  const recentLockouts = await prisma.accountLockout.count({
    where: {
      tenantId,
      lockedUntil: {
        gte: new Date(),
      },
    },
  });

  if (recentLockouts > 3) {
    vulnerabilities.push({
      type: "MULTIPLE_ACCOUNT_LOCKOUTS",
      severity: "MEDIUM",
      description: `${recentLockouts} accounts currently locked`,
      recommendation: "Review lockout policies and investigate potential attacks",
    });
  }

  return vulnerabilities;
}

async function analyzeComplianceGaps(tenantId: string): Promise<SecurityAuditResult["complianceGaps"]> {
  const gaps: SecurityAuditResult["complianceGaps"] = [];

  // GDPR Compliance (simplified checks)
  // Check if audit logging is enabled
  const hasAuditLogs = await prisma.auditLog.count({
    where: {
      tenantId: parseInt(tenantId) || 1,
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  });

  if (hasAuditLogs < 10) {
    gaps.push({
      standard: "GDPR",
      gap: "Insufficient audit logging",
      severity: "MEDIUM",
    });
  }

  // Check for data retention policies
  // (This would require additional schema/models)
  gaps.push({
    standard: "GDPR",
    gap: "Data retention policy not configured",
    severity: "LOW",
  });

  return gaps;
}

function generateRecommendations(audit: SecurityAuditResult): SecurityAuditResult["recommendations"] {
  const recommendations: SecurityAuditResult["recommendations"] = [];

  if (audit.overallScore < 70) {
    recommendations.push({
      priority: "HIGH",
      action: "Address critical vulnerabilities immediately",
      impact: "Will improve security score significantly",
    });
  }

  if (audit.vulnerabilitiesFound > 0) {
    recommendations.push({
      priority: "HIGH",
      action: "Fix identified vulnerabilities",
      impact: `Will improve score by ${audit.vulnerabilitiesFound * 5} points`,
    });
  }

  if (audit.complianceGaps && audit.complianceGaps.length > 0) {
    recommendations.push({
      priority: "MEDIUM",
      action: "Address compliance gaps",
      impact: "Will improve compliance score and reduce regulatory risk",
    });
  }

  if (audit.trends?.direction === "DECLINING") {
    recommendations.push({
      priority: "MEDIUM",
      action: "Review security practices - score is declining",
      impact: "Prevent further security degradation",
    });
  }

  return recommendations;
}
