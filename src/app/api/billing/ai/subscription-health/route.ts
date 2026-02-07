// AI Subscription Management API
// POST /api/billing/ai/subscription-health

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { analyzeSubscriptionHealth } from "@/lib/ai/subscription-health";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "subscriptionId is required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";

    // Analyze subscription
    const health = await analyzeSubscriptionHealth(tenantId, subscriptionId);

    // Save analysis
    const savedHealth = await prisma.aISubscriptionHealth.create({
      data: {
        tenantId,
        subscriptionId,
        analysisDate: new Date(),
        healthScore: health.healthScore,
        healthLevel: health.healthStatus === "HEALTHY" ? "GOOD" : health.healthStatus === "AT_RISK" ? "FAIR" : "POOR",
        churnProbability: health.churnProbability ? new Prisma.Decimal(health.churnProbability) : new Prisma.Decimal(0),
        churnRiskLevel: health.healthStatus === "HEALTHY" ? "LOW" : health.healthStatus === "AT_RISK" ? "MEDIUM" : "HIGH",
        recommendedPlan: health.recommendedPlan || null,
        recommendedAction: health.recommendedAction || null,
        usageTrend: health.usageTrend || null,
        reasoning: health.reasoning || null,
      },
    });

    return NextResponse.json({
      success: true,
      health: {
        id: savedHealth.id,
        healthScore: health.healthScore,
        healthStatus: savedHealth.healthLevel,
        churnProbability: health.churnProbability,
        recommendedPlan: health.recommendedPlan,
        recommendedAction: health.recommendedAction,
        usageTrend: health.usageTrend,
        reasoning: health.reasoning,
      },
    });
  } catch (error: any) {
    console.error("Subscription health API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/billing/ai/subscription-health - Get health analysis
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const subscriptionId = searchParams.get("subscriptionId");

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "subscriptionId is required" },
        { status: 400 }
      );
    }

    const health = await prisma.aISubscriptionHealth.findFirst({
      where: {
        tenantId,
        subscriptionId,
      },
      orderBy: {
        analysisDate: "desc",
      },
    });

    if (!health) {
      return NextResponse.json(
        { error: "Health analysis not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      health: {
        id: health.id,
        healthScore: health.healthScore,
        healthStatus: health.healthLevel,
        churnProbability: health.churnProbability,
        recommendedPlan: health.recommendedPlan,
        recommendedAction: health.recommendedAction,
        usageTrend: health.usageTrend,
        reasoning: health.reasoning,
      },
    });
  } catch (error: any) {
    console.error("Get subscription health API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
