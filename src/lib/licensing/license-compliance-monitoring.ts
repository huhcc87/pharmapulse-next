// License Compliance Monitoring
// Real-time compliance tracking, alerts, reporting

import { PrismaClient } from "@prisma/client";
import { analyzeLicenseCompliance } from "@/lib/ai/license-compliance";

const prisma = new PrismaClient();

export interface ComplianceMonitoringResult {
  isCompliant: boolean;
  complianceScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  alerts: Array<{
    type: string;
    severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
    message: string;
    timestamp: Date;
  }>;
  violations: Array<{
    type: string;
    description: string;
    timestamp: Date;
  }>;
  recommendations: string[];
}

/**
 * Monitor license compliance
 */
export async function monitorLicenseCompliance(
  tenantId: string
): Promise<ComplianceMonitoringResult> {
  try {
    // Get license
    const license = await prisma.license.findUnique({
      where: { tenantId },
    });

    if (!license) {
      throw new Error("License not found");
    }

    // Analyze compliance
    const compliance = await analyzeLicenseCompliance(tenantId, license.id);

    // Generate alerts
    const alerts: ComplianceMonitoringResult["alerts"] = [];

    if (compliance.riskLevel === "CRITICAL") {
      alerts.push({
        type: "COMPLIANCE_CRITICAL",
        severity: "CRITICAL",
        message: "License compliance is critical. Immediate action required.",
        timestamp: new Date(),
      });
    } else if (compliance.riskLevel === "HIGH") {
      alerts.push({
        type: "COMPLIANCE_HIGH",
        severity: "ERROR",
        message: "License compliance risk is high.",
        timestamp: new Date(),
      });
    }

    if (compliance.deviceViolations > 0) {
      alerts.push({
        type: "DEVICE_VIOLATION",
        severity: "WARNING",
        message: `${compliance.deviceViolations} device violation(s) detected.`,
        timestamp: new Date(),
      });
    }

    if (compliance.ipViolations > 0) {
      alerts.push({
        type: "IP_VIOLATION",
        severity: "WARNING",
        message: `${compliance.ipViolations} IP violation(s) detected.`,
        timestamp: new Date(),
      });
    }

    // Get violations from audit logs
    const violations: ComplianceMonitoringResult["violations"] = [];
    const recentViolations = await prisma.licenseAuditLog.findMany({
      where: {
        tenantId,
        licenseId: license.id,
        action: {
          in: ["LOGIN_BLOCKED_DEVICE", "LOGIN_BLOCKED_IP"],
        },
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    });

    for (const violation of recentViolations) {
      violations.push({
        type: violation.action,
        description: (violation.meta as any)?.reason || violation.action,
        timestamp: violation.createdAt,
      });
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (compliance.recommendedTier === "UPGRADE") {
      recommendations.push("Consider upgrading your license tier to accommodate current usage.");
    } else if (compliance.recommendedTier === "DOWNGRADE") {
      recommendations.push(`Consider downgrading to save ₹${(compliance.costSavings || 0) / 100} annually.`);
    }

    if (compliance.deviceViolations > 0) {
      recommendations.push("Review device registration to prevent violations.");
    }

    if (compliance.ipViolations > 0) {
      recommendations.push("Review IP address restrictions to prevent violations.");
    }

    return {
      isCompliant: compliance.complianceScore >= 80,
      complianceScore: compliance.complianceScore,
      riskLevel: compliance.riskLevel,
      alerts,
      violations,
      recommendations,
    };
  } catch (error: any) {
    console.error("Monitor license compliance error:", error);
    throw error;
  }
}
