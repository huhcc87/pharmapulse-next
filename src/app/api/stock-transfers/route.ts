// Stock Transfer Note (STN) Management API
// GET /api/stock-transfers - List STNs
// POST /api/stock-transfers - Create STN

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createStockTransfer } from "@/lib/inventory/stock-transfer";

const DEMO_TENANT_ID = 1;

function toInt(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function resolveTenantId(user: any): number {
  return toInt(user?.tenantId) ?? DEMO_TENANT_ID;
}

function resolveUserId(user: any): number {
  return toInt(user?.userId) ?? 1;
}

// GET /api/stock-transfers - List stock transfers
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status") ?? undefined;
    const fromBranchId = toInt(searchParams.get("fromBranchId"));
    const toBranchId = toInt(searchParams.get("toBranchId"));

    const tenantId = resolveTenantId(user);

    const where: any = { tenantId };

    if (status) where.status = status;
    if (fromBranchId !== undefined) where.fromBranchId = fromBranchId;
    if (toBranchId !== undefined) where.toBranchId = toBranchId;

    const stockTransfers = await prisma.stockTransferNote.findMany({
      where,
      include: { lineItems: true },
      orderBy: { transferDate: "desc" },
    });

    return NextResponse.json({ stockTransfers });
  } catch (error: any) {
    console.error("List stock transfers API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/stock-transfers - Create stock transfer
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();

    const fromBranchId = toInt(body?.fromBranchId);
    const toBranchId = toInt(body?.toBranchId);
    const lineItems = body?.lineItems;
    const notes =
      typeof body?.notes === "string" ? body.notes : (body?.notes ?? undefined);

    if (fromBranchId === undefined || toBranchId === undefined) {
      return NextResponse.json(
        { error: "fromBranchId and toBranchId are required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(lineItems) || lineItems.length === 0) {
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

    const tenantId = resolveTenantId(user);
    const userId = resolveUserId(user);

    const result = await createStockTransfer(
      {
        fromBranchId,
        toBranchId,
        lineItems,
        notes,
      },
      tenantId,
      userId
    );

    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || "Stock transfer creation failed" },
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
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
