// AI Payment Fraud Detection API
// POST /api/billing/ai/payment-risk

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { analyzePaymentRisk } from "@/lib/ai/payment-fraud";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json(
        { error: "paymentId is required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";

    // Analyze payment
    const risk = await analyzePaymentRisk(tenantId, paymentId);

    // Save analysis
    const savedRisk = await prisma.aIPaymentRisk.create({
      data: {
        tenantId,
        paymentId,
        analysisDate: new Date(),
        riskScore: risk.riskScore,
        riskLevel: risk.riskLevel,
        isAnomaly: risk.riskLevel === "HIGH" || risk.riskLevel === "CRITICAL",
        anomalyType: risk.riskLevel === "HIGH" || risk.riskLevel === "CRITICAL" ? "PATTERN" : null,
        chargebackProbability: risk.chargebackProbability ?? null,
        isHighChargebackRisk: (risk.chargebackProbability ?? 0) > 50,
        paymentPattern: risk.fraudIndicators
          ? JSON.parse(JSON.stringify(risk.fraudIndicators))
          : null,
        recommendations: risk.recommendation
          ? JSON.parse(JSON.stringify([{ type: "ACTION", message: risk.recommendation, reasoning: risk.reasoning }]))
          : null,
      },
    });

    return NextResponse.json({
      success: true,
      risk: {
        id: savedRisk.id,
        riskScore: risk.riskScore,
        riskLevel: risk.riskLevel,
        isFraudulent: risk.riskLevel === "HIGH" || risk.riskLevel === "CRITICAL",
        fraudIndicators: risk.fraudIndicators,
        chargebackProbability: risk.chargebackProbability,
        chargebackRiskFactors: risk.chargebackRiskFactors,
        recommendation: risk.recommendation,
        reasoning: risk.reasoning,
      },
    });
  } catch (error: any) {
    console.error("Payment fraud detection API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/billing/ai/payment-risk - Get risk analysis for payment
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const paymentId = searchParams.get("paymentId");
    const riskLevel = searchParams.get("riskLevel");

    const where: any = { tenantId };
    if (paymentId) {
      where.paymentId = paymentId;
    }
    if (riskLevel) {
      where.riskLevel = riskLevel;
    }

    const risks = await prisma.aIPaymentRisk.findMany({
      where,
      orderBy: {
        analysisDate: "desc",
      },
      take: 50,
    });

    return NextResponse.json({
      risks: risks.map((r) => ({
        id: r.id,
        paymentId: r.paymentId,
        riskScore: r.riskScore,
        riskLevel: r.riskLevel,
        isFraudulent: r.riskLevel === "HIGH" || r.riskLevel === "CRITICAL",
        chargebackProbability: r.chargebackProbability,
        analysisDate: r.analysisDate,
      })),
    });
  } catch (error: any) {
    console.error("Get payment risks API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
