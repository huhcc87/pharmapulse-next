// Purchase Order Approval API
// POST /api/purchase-orders/[id]/approve

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    // Only Owner/Admin/Pharmacist can approve POs
    const allowedRoles = ["OWNER", "ADMIN", "SUPER_ADMIN", "PHARMACIST"];
    const userRole = user.role.toUpperCase();
    
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: "Access denied. Only Owner/Admin/Pharmacist can approve purchase orders." },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const poId = parseInt(resolvedParams.id);
    const body = await req.json();
    const { action } = body; // "APPROVE" or "REJECT"

    // Fetch PO
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { vendor: true, lineItems: true },
    });

    if (!purchaseOrder) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    if (purchaseOrder.tenantId !== DEMO_TENANT_ID) {
      return NextResponse.json(
        { error: "Purchase order not found" },
        { status: 404 }
      );
    }

    if (purchaseOrder.status !== "DRAFT") {
      return NextResponse.json(
        { error: `Purchase order is already ${purchaseOrder.status}. Cannot approve.` },
        { status: 400 }
      );
    }

    const userId = parseInt(user.userId || "1");

    if (action === "APPROVE") {
      // Approve PO
      const updatedPO = await prisma.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: "SENT", // Approved and sent to vendor
          approvedBy: userId,
          approvedAt: new Date(),
        },
        include: {
          vendor: true,
          lineItems: true,
        },
      });

      return NextResponse.json({
        success: true,
        purchaseOrder: updatedPO,
        message: "Purchase order approved and marked as sent",
      });
    } else if (action === "REJECT") {
      // Reject/Cancel PO
      const updatedPO = await prisma.purchaseOrder.update({
        where: { id: poId },
        data: {
          status: "CANCELLED",
          approvedBy: userId,
          approvedAt: new Date(),
        },
        include: {
          vendor: true,
          lineItems: true,
        },
      });

      return NextResponse.json({
        success: true,
        purchaseOrder: updatedPO,
        message: "Purchase order rejected/cancelled",
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'APPROVE' or 'REJECT'" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Purchase order approval API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
