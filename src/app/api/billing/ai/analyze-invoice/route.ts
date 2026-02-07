// AI Invoice Analysis & Categorization API
// POST /api/billing/ai/analyze-invoice

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { analyzeInvoice } from "@/lib/ai/invoice-analysis";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { invoiceId } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { error: "invoiceId is required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";

    // Analyze invoice
    const analysis = await analyzeInvoice(tenantId, invoiceId);

    // Save analysis
    const savedAnalysis = await prisma.aIInvoiceAnalysis.create({
      data: {
        tenantId,
        invoiceId,
        analysisDate: new Date(),
        category: analysis.category || null,
        subcategory: analysis.subcategory || null,
        isAnomaly: analysis.isAnomaly,
        anomalyType: analysis.anomalyType || null,
        anomalyScore: analysis.anomalyScore || null,
        isDuplicate: analysis.isDuplicate,
        duplicateInvoiceIds: analysis.duplicateInvoiceIds
          ? JSON.parse(JSON.stringify(analysis.duplicateInvoiceIds))
          : null,
        similarityScore: analysis.similarityScore || null,
        summary: analysis.summary || null,
        keyPoints: analysis.keyPoints
          ? JSON.parse(JSON.stringify(analysis.keyPoints))
          : null,
        searchKeywords: analysis.searchKeywords
          ? JSON.parse(JSON.stringify(analysis.searchKeywords))
          : null,
      },
    });

    return NextResponse.json({
      success: true,
      analysis: {
        id: savedAnalysis.id,
        category: analysis.category,
        subcategory: analysis.subcategory,
        isAnomaly: analysis.isAnomaly,
        anomalyType: analysis.anomalyType,
        anomalyScore: analysis.anomalyScore,
        isDuplicate: analysis.isDuplicate,
        duplicateInvoiceIds: analysis.duplicateInvoiceIds,
        similarityScore: analysis.similarityScore,
        summary: analysis.summary,
        keyPoints: analysis.keyPoints,
        searchKeywords: analysis.searchKeywords,
      },
    });
  } catch (error: any) {
    console.error("Invoice analysis API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/billing/ai/analyze-invoice - Get analysis for invoice
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const invoiceId = searchParams.get("invoiceId");

    if (!invoiceId) {
      return NextResponse.json(
        { error: "invoiceId is required" },
        { status: 400 }
      );
    }

    const analysis = await prisma.aIInvoiceAnalysis.findFirst({
      where: {
        tenantId,
        invoiceId,
      },
      orderBy: {
        analysisDate: "desc",
      },
    });

    if (!analysis) {
      return NextResponse.json(
        { error: "Analysis not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      analysis: {
        id: analysis.id,
        category: analysis.category,
        subcategory: analysis.subcategory,
        isAnomaly: analysis.isAnomaly,
        anomalyType: analysis.anomalyType,
        anomalyScore: analysis.anomalyScore,
        isDuplicate: analysis.isDuplicate,
        duplicateInvoiceIds: analysis.duplicateInvoiceIds,
        similarityScore: analysis.similarityScore,
        summary: analysis.summary,
        keyPoints: analysis.keyPoints,
        searchKeywords: analysis.searchKeywords,
      },
    });
  } catch (error: any) {
    console.error("Get invoice analysis API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
