// License Optimization Recommendations
// AI-powered recommendations for license tier changes, cost savings

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface LicenseOptimizationResult {
  currentTier: string;
  recommendedTier?: string;
  costSavingsPaise?: number;
  reasoning?: string;
  usageAnalysis?: {
    currentUsage: number;
    usageLimit: number;
    utilizationPercent: number;
  };
  recommendations?: Array<{
    type: "UPGRADE" | "DOWNGRADE" | "MAINTAIN";
    reason: string;
    impact: string;
  }>;
}

/**
 * Analyze license and provide optimization recommendations
 */
export async function analyzeLicenseOptimization(
  tenantId: string
): Promise<LicenseOptimizationResult> {
  try {
    const result: LicenseOptimizationResult = {
      currentTier: "BASIC",
      recommendations: [],
    };

    // Get license
    const license = await prisma.license.findUnique({
      where: { tenantId },
      include: {
        deviceRegistrations: {
          where: { revokedAt: null },
        },
        auditLogs: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
        },
      },
    });

    if (!license) {
      throw new Error("License not found");
    }

    // Determine current tier (simplified)
    result.currentTier = license.maxDevices ? "PREMIUM" : "BASIC";

    // Analyze usage
    const currentUsage = license.deviceRegistrations.length;
    const usageLimit = license.maxDevices || 1;
    const utilizationPercent = (currentUsage / usageLimit) * 100;

    result.usageAnalysis = {
      currentUsage,
      usageLimit,
      utilizationPercent,
    };

    // Generate recommendations
    if (utilizationPercent > 90) {
      result.recommendedTier = "UPGRADE";
      result.recommendations?.push({
        type: "UPGRADE",
        reason: "License usage is at 90%+ capacity",
        impact: "Upgrading will allow more devices and prevent lockouts",
      });
      result.costSavingsPaise = 0; // No savings, but better service
    } else if (utilizationPercent < 30 && license.maxDevices && license.maxDevices > 1) {
      result.recommendedTier = "DOWNGRADE";
      result.recommendations?.push({
        type: "DOWNGRADE",
        reason: "License usage is below 30%",
        impact: "Downgrading can save costs without impacting functionality",
      });
      result.costSavingsPaise = 500000; // Example: ₹5,000 savings
    } else {
      result.recommendedTier = "MAINTAIN";
      result.recommendations?.push({
        type: "MAINTAIN",
        reason: "License usage is optimal",
        impact: "Current tier matches usage patterns",
      });
    }

    // Reasoning
    result.reasoning = `License optimization analysis: Current tier is ${result.currentTier} with ${utilizationPercent.toFixed(1)}% utilization. `;
    if (result.recommendedTier === "UPGRADE") {
      result.reasoning += "Recommend upgrading to prevent capacity issues.";
    } else if (result.recommendedTier === "DOWNGRADE") {
      result.reasoning += `Recommend downgrading to save ₹${(result.costSavingsPaise || 0) / 100} annually.`;
    } else {
      result.reasoning += "Current tier is optimal for your usage.";
    }

    return result;
  } catch (error: any) {
    console.error("License optimization analysis error:", error);
    throw error;
  }
}
