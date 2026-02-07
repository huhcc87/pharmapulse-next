// AI License Compliance Monitor
// License usage prediction, anomalous usage detection, compliance risk scoring

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface LicenseComplianceResult {
  predictedUsage?: number;
  currentUsage: number;
  usageLimit: number;
  daysToExceedLimit?: number;
  complianceScore: number; // 0-100
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  deviceViolations: number;
  ipViolations: number;
  recentViolations?: Array<{
    type: string;
    date: Date;
    description: string;
  }>;
  recommendedTier?: string;
  costSavings?: number;
  reasoning?: string;
}

/**
 * Analyze license compliance
 * Predicts usage, detects violations, scores compliance risk
 */
export async function analyzeLicenseCompliance(
  tenantId: string,
  licenseId: string
): Promise<LicenseComplianceResult> {
  try {
    // Get license
    const license = await prisma.license.findUnique({
      where: { id: licenseId },
      include: {
        deviceRegistrations: {
          where: { revokedAt: null },
        },
        auditLogs: {
          where: {
            action: {
              in: ["LOGIN_BLOCKED_DEVICE", "LOGIN_BLOCKED_IP"],
            },
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 50,
        },
      },
    });

    if (!license) {
      throw new Error("License not found");
    }

    const result: LicenseComplianceResult = {
      currentUsage: license.deviceRegistrations.length,
      usageLimit: license.maxDevices || 1,
      complianceScore: 100,
      riskLevel: "LOW",
      deviceViolations: 0,
      ipViolations: 0,
    };

    // Calculate device violations
    const deviceViolations = license.auditLogs.filter(
      (log) => log.action === "LOGIN_BLOCKED_DEVICE"
    ).length;
    result.deviceViolations = deviceViolations;

    // Calculate IP violations
    const ipViolations = license.auditLogs.filter(
      (log) => log.action === "LOGIN_BLOCKED_IP"
    ).length;
    result.ipViolations = ipViolations;

    // Calculate compliance score (starts at 100, deducts for violations)
    result.complianceScore = 100;
    result.complianceScore -= deviceViolations * 10; // -10 per device violation
    result.complianceScore -= ipViolations * 15; // -15 per IP violation

    // Usage prediction (simple linear projection)
    const usageHistory = await getUsageHistory(tenantId, licenseId);
    if (usageHistory.length > 0) {
      const avgDailyUsage = usageHistory.reduce((sum, u) => sum + u.usage, 0) / usageHistory.length;
      const predictedUsage = Math.ceil(avgDailyUsage * 30); // Next 30 days
      result.predictedUsage = predictedUsage;

      if (predictedUsage > result.usageLimit) {
        const excess = predictedUsage - result.usageLimit;
        const daysToExceed = Math.ceil(result.usageLimit / avgDailyUsage);
        result.daysToExceedLimit = daysToExceed;
        result.complianceScore -= 20; // Penalty for predicted overage
      }
    }

    // Determine risk level
    if (result.complianceScore >= 90) {
      result.riskLevel = "LOW";
    } else if (result.complianceScore >= 70) {
      result.riskLevel = "MEDIUM";
    } else if (result.complianceScore >= 50) {
      result.riskLevel = "HIGH";
    } else {
      result.riskLevel = "CRITICAL";
    }

    // Recent violations
    result.recentViolations = license.auditLogs.slice(0, 10).map((log) => ({
      type: log.action,
      date: log.createdAt,
      description: (log.meta as any)?.reason || log.action,
    }));

    // Recommendations
    if (result.currentUsage >= result.usageLimit * 0.9) {
      result.recommendedTier = "UPGRADE";
      result.reasoning = "License usage approaching limit. Consider upgrading to higher tier.";
    } else if (result.currentUsage < result.usageLimit * 0.5) {
      result.recommendedTier = "DOWNGRADE";
      result.costSavings = 1000; // Example savings
      result.reasoning = "License usage is low. Consider downgrading to save costs.";
    }

    return result;
  } catch (error: any) {
    console.error("License compliance analysis error:", error);
    throw error;
  }
}

async function getUsageHistory(
  tenantId: string,
  licenseId: string
): Promise<Array<{ date: Date; usage: number }>> {
  // Get daily usage from audit logs
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const logs = await prisma.licenseAuditLog.findMany({
    where: {
      tenantId,
      licenseId,
      action: "LICENSE_CHECKED",
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
    select: {
      createdAt: true,
    },
  });

  // Group by day
  const dailyUsage = logs.reduce((acc: Record<string, number>, log) => {
    const date = log.createdAt.toISOString().split("T")[0];
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(dailyUsage).map(([date, usage]) => ({
    date: new Date(date),
    usage: usage as number,
  }));
}
