// Purchase Return Management API
// GET /api/purchase-returns - List purchase returns
// POST /api/purchase-returns - Create purchase return

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPurchaseReturn } from "@/lib/purchase/purchase-return";

const DEMO_TENANT_ID = 1;

// GET /api/purchase-returns - List purchase returns
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.url ? new URL(req.url).searchParams : new URLSearchParams();
    const status = searchParams.get("status");
    const vendorId = searchParams.get("vendorId");

    const where: any = {
      tenantId: user.tenantId || DEMO_TENANT_ID,
    };

    if (status) {
      where.status = status;
    }

    if (vendorId) {
      where.vendorId = parseInt(vendorId);
    }

    const purchaseReturns = await prisma.purchaseReturn.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            gstin: true,
          },
        },
        lineItems: true,
      },
      orderBy: {
        returnDate: "desc",
      },
    });

    return NextResponse.json({
      purchaseReturns,
    });
  } catch (error: any) {
    console.error("List purchase returns API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/purchase-returns - Create purchase return
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { grnId, purchaseOrderId, vendorId, returnItems, reason, notes } = body;

    if (!vendorId) {
      return NextResponse.json(
        { error: "vendorId is required" },
        { status: 400 }
      );
    }

    if (!returnItems || !Array.isArray(returnItems) || returnItems.length === 0) {
      return NextResponse.json(
        { error: "returnItems array is required" },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: "reason is required" },
        { status: 400 }
      );
    }

    // Create purchase return
    const result = await createPurchaseReturn(
      {
        grnId: grnId ? parseInt(grnId) : undefined,
        purchaseOrderId: purchaseOrderId ? parseInt(purchaseOrderId) : undefined,
        vendorId: parseInt(vendorId),
        returnItems,
        reason,
        notes,
      },
      user.tenantId || DEMO_TENANT_ID
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Purchase return creation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      purchaseReturn: {
        id: result.returnId,
        returnNumber: result.returnNumber,
      },
    });
  } catch (error: any) {
    console.error("Create purchase return API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
