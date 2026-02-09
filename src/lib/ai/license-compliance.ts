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

function toStr(value: string | number, label: string): string {
  const s = String(value ?? "").trim();
  if (!s) throw new Error(`Invalid ${label}`);
  return s;
}

/**
 * Analyze license compliance
 * Predicts usage, detects violations, scores compliance risk
 */
export async function analyzeLicenseCompliance(
  tenantId: string | number,
  licenseId: string
): Promise<LicenseComplianceResult> {
  try {
    // ✅ tenantId is STRING for LicenseAuditLog (based on TS error)
    const tenantIdStr = toStr(tenantId, "tenantId");

    // Get license
    const license = await prisma.license.findUnique({
      where: { id: licenseId },
      include: {
        deviceRegistrations: {
          where: { revokedAt: null },
        },
        auditLogs: {
          where: {
            action: { in: ["LOGIN_BLOCKED_DEVICE", "LOGIN_BLOCKED_IP"] },
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!license) throw new Error("License not found");

    const result: LicenseComplianceResult = {
      currentUsage: license.deviceRegistrations.length,
      usageLimit: license.maxDevices || 1,
      complianceScore: 100,
      riskLevel: "LOW",
      deviceViolations: 0,
      ipViolations: 0,
    };

    // Device/IP violations from included auditLogs (already filtered)
    result.deviceViolations = license.auditLogs.filter(
      (log) => log.action === "LOGIN_BLOCKED_DEVICE"
    ).length;

    result.ipViolations = license.auditLogs.filter(
      (log) => log.action === "LOGIN_BLOCKED_IP"
    ).length;

    // Compliance score deductions
    result.complianceScore = 100;
    result.complianceScore -= result.deviceViolations * 10;
    result.complianceScore -= result.ipViolations * 15;

    // Usage prediction
    const usageHistory = await getUsageHistory(tenantIdStr, licenseId);
    if (usageHistory.length > 0) {
      const avgDailyUsage =
        usageHistory.reduce((sum, u) => sum + u.usage, 0) / usageHistory.length;

      const predictedUsage = Math.ceil(avgDailyUsage * 30);
      result.predictedUsage = predictedUsage;

      if (avgDailyUsage > 0 && predictedUsage > result.usageLimit) {
        result.daysToExceedLimit = Math.ceil(result.usageLimit / avgDailyUsage);
        result.complianceScore -= 20;
      }
    }

    // Risk level
    if (result.complianceScore >= 90) result.riskLevel = "LOW";
    else if (result.complianceScore >= 70) result.riskLevel = "MEDIUM";
    else if (result.complianceScore >= 50) result.riskLevel = "HIGH";
    else result.riskLevel = "CRITICAL";

    // Recent violations
    result.recentViolations = license.auditLogs.slice(0, 10).map((log) => ({
      type: log.action,
      date: log.createdAt,
      description: (log.meta as any)?.reason || log.action,
    }));

    // Tier recommendations (simple heuristics)
    if (result.currentUsage >= result.usageLimit * 0.9) {
      result.recommendedTier = "UPGRADE";
      result.reasoning = "License usage approaching limit. Consider upgrading to a higher tier.";
    } else if (result.currentUsage < result.usageLimit * 0.5) {
      result.recommendedTier = "DOWNGRADE";
      result.costSavings = 1000; // placeholder
      result.reasoning = "License usage is low. Consider downgrading to save costs.";
    }

    // Clamp score to [0,100]
    result.complianceScore = Math.max(0, Math.min(100, result.complianceScore));

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
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // ✅ IMPORTANT:
  // Your schema expects `licenceId` (not `licenseId`)
  // And tenantId is string for this model (per TS error)
  const logs = await prisma.licenseAuditLog.findMany({
    where: {
      tenantId, // ✅ string
      licenceId: licenseId, // ✅ British spelling (schema)
      action: "LICENSE_CHECKED",
      createdAt: { gte: thirtyDaysAgo },
    },
    select: { createdAt: true },
  });

  const dailyUsage = logs.reduce((acc: Record<string, number>, log) => {
    const day = log.createdAt.toISOString().split("T")[0];
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(dailyUsage).map(([date, usage]) => ({
    date: new Date(date),
    usage,
  }));
}
