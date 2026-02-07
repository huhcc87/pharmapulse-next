// Stock Transfer Note (STN) Management API
// GET /api/stock-transfers - List STNs
// POST /api/stock-transfers - Create STN

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createStockTransfer } from "@/lib/inventory/stock-transfer";

const DEMO_TENANT_ID = 1;

// GET /api/stock-transfers - List stock transfers
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.url ? new URL(req.url).searchParams : new URLSearchParams();
    const status = searchParams.get("status");
    const fromBranchId = searchParams.get("fromBranchId");
    const toBranchId = searchParams.get("toBranchId");

    const where: any = {
      tenantId: user.tenantId || DEMO_TENANT_ID,
    };

    if (status) {
      where.status = status;
    }

    if (fromBranchId) {
      where.fromBranchId = parseInt(fromBranchId);
    }

    if (toBranchId) {
      where.toBranchId = parseInt(toBranchId);
    }

    const stockTransfers = await prisma.stockTransferNote.findMany({
      where,
      include: {
        lineItems: true,
      },
      orderBy: {
        transferDate: "desc",
      },
    });

    return NextResponse.json({
      stockTransfers,
    });
  } catch (error: any) {
    console.error("List stock transfers API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/stock-transfers - Create stock transfer
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { fromBranchId, toBranchId, lineItems, notes } = body;

    if (!fromBranchId || !toBranchId) {
      return NextResponse.json(
        { error: "fromBranchId and toBranchId are required" },
        { status: 400 }
      );
    }

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { error: "lineItems array is required" },
        { status: 400 }
      );
    }

    if (fromBranchId === toBranchId) {
      return NextResponse.json(
        { error: "Source and destination branches cannot be the same" },
        { status: 400 }
      );
    }

    // Create stock transfer
    const result = await createStockTransfer(
      {
        fromBranchId: parseInt(fromBranchId),
        toBranchId: parseInt(toBranchId),
        lineItems,
        notes,
      },
      user.tenantId || DEMO_TENANT_ID,
      parseInt(user.userId || "1")
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Stock transfer creation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      stockTransfer: {
        id: result.stnId,
        stnNumber: result.stnNumber,
      },
    });
  } catch (error: any) {
    console.error("Create stock transfer API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
