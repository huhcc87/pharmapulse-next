// Purchase Return Management API
// GET /api/purchase-returns - List purchase returns
// POST /api/purchase-returns - Create purchase return

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPurchaseReturn } from "@/lib/purchase/purchase-return";

const DEMO_TENANT_ID = 1;

function toInt(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function resolveTenantId(user: any): number {
  // user.tenantId might be string | number | undefined
  const n = toInt(user?.tenantId);
  return n ?? DEMO_TENANT_ID;
}

// GET /api/purchase-returns - List purchase returns
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = resolveTenantId(user);

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const vendorId = toInt(url.searchParams.get("vendorId"));

    const where: any = {
      // ✅ Keep this ONLY if PurchaseReturn has tenantId in your Prisma schema.
      tenantId,
    };

    if (status) where.status = status;
    if (vendorId !== undefined) where.vendorId = vendorId;

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
      orderBy: { returnDate: "desc" },
    });

    return NextResponse.json({ purchaseReturns });
  } catch (error: any) {
    console.error("List purchase returns API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/purchase-returns - Create purchase return
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = resolveTenantId(user);

    const body = await req.json();
    const { grnId, purchaseOrderId, vendorId, returnItems, reason, notes } = body ?? {};

    const vendorIdNum = toInt(vendorId);

    if (vendorIdNum === undefined) {
      return NextResponse.json({ error: "vendorId is required" }, { status: 400 });
    }

    if (!Array.isArray(returnItems) || returnItems.length === 0) {
      return NextResponse.json(
        { error: "returnItems array is required" },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json({ error: "reason is required" }, { status: 400 });
    }

    const result = await createPurchaseReturn(
      {
        grnId: toInt(grnId),
        purchaseOrderId: toInt(purchaseOrderId),
        vendorId: vendorIdNum,
        returnItems,
        reason,
        notes,
      },
      tenantId // ✅ always number now
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
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
