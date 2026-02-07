// Cash Memo Generation API
// POST /api/invoices/cash-memo - Generate cash memo for small sales (<₹200)

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { generateCashMemo } from "@/lib/invoice/cash-memo";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { lineItems, customerName, customerPhone } = body;

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { error: "lineItems array is required" },
        { status: 400 }
      );
    }

    // Get seller GSTIN (default to first GSTIN for tenant)
    const sellerGstin = await prisma.orgGstin.findFirst({
      where: {
        org: {
          tenants: {
            some: {
              id: user.tenantId || 1,
            },
          },
        },
      },
    });

    if (!sellerGstin) {
      return NextResponse.json(
        { error: "Seller GSTIN not found. Please configure organization GSTIN." },
        { status: 404 }
      );
    }

    // Generate cash memo
    const result = await generateCashMemo({
      lineItems,
      customerName,
      customerPhone,
      tenantId: user.tenantId || 1,
      sellerGstinId: sellerGstin.id,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Cash memo generation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      cashMemo: {
        id: result.cashMemoId,
        cashMemoNumber: result.cashMemoNumber,
        totalAmountPaise: result.totalAmountPaise,
      },
    });
  } catch (error: any) {
    console.error("Cash memo API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
