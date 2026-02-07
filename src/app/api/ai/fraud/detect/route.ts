// AI Fraud Detection API
// POST /api/ai/fraud/detect

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { detectFraud } from "@/lib/ai/fraud-detection";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { invoiceId, transactionId } = body;

    if (!invoiceId && !transactionId) {
      return NextResponse.json(
        { error: "invoiceId or transactionId is required" },
        { status: 400 }
      );
    }

    // Detect fraud
    const invoiceIdNum = invoiceId ? parseInt(invoiceId) : undefined;
    if (!invoiceIdNum) {
      return NextResponse.json(
        { error: "invoiceId is required for fraud detection" },
        { status: 400 }
      );
    }

    const fraudResult = await detectFraud(invoiceIdNum, DEMO_TENANT_ID);

    // Save fraud detection result
    const savedDetection = await prisma.aIFraudDetection.create({
      data: {
        tenantId: DEMO_TENANT_ID,
        invoiceId: invoiceIdNum,
        transactionId: transactionId || `TXN-${invoiceIdNum}-${Date.now()}`,
        detectionDate: new Date(),
        fraudRiskScore: fraudResult.fraudRiskScore,
        riskLevel: fraudResult.riskLevel,
        amountAnomaly: fraudResult.amountAnomaly,
        timeAnomaly: fraudResult.timeAnomaly,
        patternAnomaly: fraudResult.patternAnomaly,
        isDuplicate: fraudResult.isDuplicate,
        isInflated: fraudResult.isInflated,
        isInsuranceFraud: fraudResult.isInsuranceFraud,
        isPaymentFraud: fraudResult.isPaymentFraud,
        customerRiskScore: fraudResult.customerRiskScore || null,
        customerRiskLevel: fraudResult.customerRiskLevel || null,
        fraudIndicators: fraudResult.fraudIndicators
          ? JSON.parse(JSON.stringify(fraudResult.fraudIndicators))
          : null,
        fraudReason: fraudResult.fraudReason || null,
        status: fraudResult.riskLevel === "CRITICAL" ? "DETECTED" : "DETECTED",
      },
    });

    return NextResponse.json({
      success: true,
      fraudDetection: {
        id: savedDetection.id,
        fraudRiskScore: fraudResult.fraudRiskScore,
        riskLevel: fraudResult.riskLevel,
        amountAnomaly: fraudResult.amountAnomaly,
        timeAnomaly: fraudResult.timeAnomaly,
        patternAnomaly: fraudResult.patternAnomaly,
        isDuplicate: fraudResult.isDuplicate,
        isInsuranceFraud: fraudResult.isInsuranceFraud,
        isPaymentFraud: fraudResult.isPaymentFraud,
        customerRiskScore: fraudResult.customerRiskScore,
        customerRiskLevel: fraudResult.customerRiskLevel,
        fraudIndicators: fraudResult.fraudIndicators,
        fraudReason: fraudResult.fraudReason,
        requiresReview: fraudResult.riskLevel === "HIGH" || fraudResult.riskLevel === "CRITICAL",
      },
    });
  } catch (error: any) {
    console.error("Fraud detection API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/ai/fraud/detect - Get fraud detection history
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const riskLevel = searchParams.get("riskLevel");
    const status = searchParams.get("status");

    const where: any = {
      tenantId: DEMO_TENANT_ID,
    };

    if (riskLevel) {
      where.riskLevel = riskLevel;
    }

    if (status) {
      where.status = status;
    }

    const detections = await prisma.aIFraudDetection.findMany({
      where,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalInvoicePaise: true,
            invoiceDate: true,
          },
        },
      },
      orderBy: {
        detectionDate: "desc",
      },
      take: 100,
    });

    return NextResponse.json({
      detections: detections.map((d) => ({
        id: d.id,
        invoice: d.invoice,
        fraudRiskScore: d.fraudRiskScore,
        riskLevel: d.riskLevel,
        status: d.status,
        fraudIndicators: d.fraudIndicators,
        fraudReason: d.fraudReason,
        detectionDate: d.detectionDate,
      })),
    });
  } catch (error: any) {
    console.error("Get fraud detections API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
