// License Usage Analytics Dashboard
// GET /api/licensing/usage-analytics

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";

    // Get license
    const license = await prisma.license.findUnique({
      where: { tenantId },
      include: {
        deviceRegistrations: {
          where: { revokedAt: null },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 100,
        },
      },
    });

    if (!license) {
      return NextResponse.json(
        { error: "License not found" },
        { status: 404 }
      );
    }

    // Calculate usage statistics
    const activeDevices = license.deviceRegistrations.length;
    const maxDevices = license.maxDevices || 1;
    const deviceUsagePercent = (activeDevices / maxDevices) * 100;

    // Get usage trends (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentLogs = license.auditLogs.filter(
      (log) => log.createdAt >= thirtyDaysAgo
    );

    // Group by day
    const dailyUsage = recentLogs.reduce((acc: Record<string, number>, log) => {
      const date = log.createdAt.toISOString().split("T")[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    // Calculate trends
    const usageTrend = calculateTrend(Object.values(dailyUsage));

    return NextResponse.json({
      license: {
        id: license.id,
        plan: license.plan,
        status: license.status,
        maxDevices,
        activeDevices,
        deviceUsagePercent: Math.round(deviceUsagePercent),
      },
      usage: {
        totalEvents: license.auditLogs.length,
        recentEvents: recentLogs.length,
        dailyUsage,
        trend: usageTrend, // INCREASING, DECREASING, STABLE
      },
      compliance: {
        deviceCompliant: activeDevices <= maxDevices,
        ipCompliant: true, // Check IP compliance
      },
    });
  } catch (error: any) {
    console.error("License usage analytics API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

function calculateTrend(values: number[]): "INCREASING" | "DECREASING" | "STABLE" {
  if (values.length < 2) return "STABLE";

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const change = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (change > 10) return "INCREASING";
  if (change < -10) return "DECREASING";
  return "STABLE";
}
