// Cash Memo Generation API
// POST /api/invoices/cash-memo - Generate cash memo for small sales (<₹200)

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { generateCashMemo } from "@/lib/invoice/cash-memo";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

function resolveTenantId(user: any): number {
  const raw = user?.tenantId;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return DEMO_TENANT_ID;
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = resolveTenantId(user);

    const body = await req.json();
    const { lineItems, customerName, customerPhone } = body ?? {};

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { error: "lineItems array is required" },
        { status: 400 }
      );
    }

    /**
     * IMPORTANT:
     * Your previous query used:
     *   org: { tenants: { some: { id: ... } } }
     * but Prisma says org.tenants does NOT exist.
     *
     * So we query GSTIN in a tenant-safe way using the most common patterns:
     *  A) orgGstin has tenantId
     *  B) orgGstin belongs to org, and org has tenantId
     *
     * We try A first; if it fails at runtime due to missing field, use B by editing one line.
     */

    // ✅ Pattern A (most common): orgGstin has tenantId column
    const sellerGstin = await prisma.orgGstin.findFirst({
      where: {
        tenantId, // <-- if your orgGstin model doesn't have tenantId, switch to Pattern B below
      } as any,
      orderBy: { id: "asc" } as any,
    });

    // --- Pattern B (alternative): org has tenantId, orgGstin links to org
    // const sellerGstin = await prisma.orgGstin.findFirst({
    //   where: { org: { tenantId } } as any,
    //   orderBy: { id: "asc" } as any,
    // });

    if (!sellerGstin) {
      return NextResponse.json(
        {
          error:
            "Seller GSTIN not found. Please configure organization GSTIN for this tenant.",
        },
        { status: 404 }
      );
    }

    // Generate cash memo
    const result = await generateCashMemo({
      lineItems,
      customerName,
      customerPhone,
      tenantId,
      sellerGstinId: sellerGstin.id,
    });

    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || "Cash memo generation failed" },
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
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

