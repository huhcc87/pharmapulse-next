// Invoice Disputes API
// GET /api/billing/invoices/disputes - List disputes
// POST /api/billing/invoices/disputes - Create dispute

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { createInvoiceDispute, resolveInvoiceDispute } from "@/lib/billing/invoice-management";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const invoiceId = searchParams.get("invoiceId");
    const status = searchParams.get("status");

    const where: any = { tenantId };
    if (invoiceId) {
      where.invoiceId = parseInt(invoiceId);
    }
    if (status) {
      where.status = status;
    }

    const disputes = await prisma.invoiceDispute.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      disputes: disputes.map((d) => ({
        id: d.id,
        invoiceId: d.invoiceId,
        disputeType: d.disputeType,
        reason: d.reason,
        status: d.status,
        requestedAdjustmentPaise: d.requestedAdjustmentPaise,
        approvedAdjustmentPaise: d.approvedAdjustmentPaise,
        createdAt: d.createdAt,
        resolvedAt: d.resolvedAt,
      })),
    });
  } catch (error: any) {
    console.error("Get invoice disputes API error:", error);
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
    const { invoiceId, ...disputeData } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { error: "invoiceId is required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";

    const dispute = await createInvoiceDispute(tenantId, invoiceId, disputeData);

    return NextResponse.json({
      success: true,
      dispute: {
        id: dispute.id,
        invoiceId: dispute.invoiceId,
        disputeType: dispute.disputeType,
        status: dispute.status,
      },
    });
  } catch (error: any) {
    console.error("Create invoice dispute API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/billing/invoices/disputes/[id]/resolve - Resolve dispute
export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { id, ...resolutionData } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";

    const dispute = await resolveInvoiceDispute(tenantId, id, {
      ...resolutionData,
      resolvedBy: user.userId || user.email || "system",
    });

    return NextResponse.json({
      success: true,
      dispute: {
        id: dispute.id,
        status: dispute.status,
        resolution: dispute.resolution,
      },
    });
  } catch (error: any) {
    console.error("Resolve invoice dispute API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
