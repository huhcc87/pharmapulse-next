// Budget Management & Controls
// GET /api/billing/budgets - List budgets
// POST /api/billing/budgets - Create budget
// PATCH /api/billing/budgets/[id] - Update budget

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const isActive = searchParams.get("isActive");

    const where: any = { tenantId };
    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    const budgets = await prisma.budget.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    // Calculate current spend for each budget
    const budgetsWithSpend = await Promise.all(
      budgets.map(async (budget) => {
        // TODO: Calculate actual spend from billing data
        const currentSpendPaise = 0; // Placeholder

        // Check alert thresholds
        const spendPercent = (currentSpendPaise / budget.limitPaise) * 100;
        let alertLevel = "NONE";
        if (spendPercent >= 100) {
          alertLevel = "CRITICAL";
        } else if (spendPercent >= 80) {
          alertLevel = "WARNING";
        } else if (spendPercent >= 50) {
          alertLevel = "WARNING";
        }

        return {
          ...budget,
          currentSpendPaise,
          spendPercent: Math.round(spendPercent),
          alertLevel,
        };
      })
    );

    return NextResponse.json({
      budgets: budgetsWithSpend,
    });
  } catch (error: any) {
    console.error("Get budgets API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const {
      budgetType,
      category,
      limitPaise,
      alertAt50Percent,
      alertAt80Percent,
      alertAt100Percent,
      periodStart,
      periodEnd,
    } = body;

    if (!budgetType || !limitPaise || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "budgetType, limitPaise, periodStart, and periodEnd are required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";

    const budget = await prisma.budget.create({
      data: {
        tenantId,
        budgetType,
        category: category || null,
        limitPaise: parseInt(limitPaise),
        alertAt50Percent: alertAt50Percent !== false,
        alertAt80Percent: alertAt80Percent !== false,
        alertAt100Percent: alertAt100Percent !== false,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      budget,
    });
  } catch (error: any) {
    console.error("Create budget API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
