// Stock Transfer Approval API
// POST /api/stock-transfers/[id]/approve

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

    // Only Owner/Admin/Pharmacist can approve STNs
    const allowedRoles = ["OWNER", "ADMIN", "SUPER_ADMIN", "PHARMACIST"];
    const userRole = user.role.toUpperCase();
    
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { error: "Access denied. Only Owner/Admin/Pharmacist can approve stock transfers." },
        { status: 403 }
      );
    }

    const resolvedParams = await params;
    const stnId = parseInt(resolvedParams.id);
    const body = await req.json();
    const { action } = body; // "APPROVE", "REJECT", "DISPATCH", "RECEIVE"

    // Fetch STN
    const stockTransfer = await prisma.stockTransferNote.findUnique({
      where: { id: stnId },
      include: { lineItems: true },
    });

    if (!stockTransfer) {
      return NextResponse.json(
        { error: "Stock transfer not found" },
        { status: 404 }
      );
    }

    if (stockTransfer.tenantId !== DEMO_TENANT_ID) {
      return NextResponse.json(
        { error: "Stock transfer not found" },
        { status: 404 }
      );
    }

    const userId = parseInt(user.userId || "1");
    let newStatus: string;
    let updateData: any = {};

    switch (action) {
      case "APPROVE":
        if (stockTransfer.status !== "DRAFT" && stockTransfer.status !== "PENDING_APPROVAL") {
          return NextResponse.json(
            { error: `Stock transfer is already ${stockTransfer.status}. Cannot approve.` },
            { status: 400 }
          );
        }
        newStatus = "APPROVED";
        updateData = {
          status: newStatus,
          approvedBy: userId,
          approvedAt: new Date(),
        };
        break;

      case "REJECT":
        if (stockTransfer.status === "RECEIVED" || stockTransfer.status === "REJECTED") {
          return NextResponse.json(
            { error: `Stock transfer is already ${stockTransfer.status}. Cannot reject.` },
            { status: 400 }
          );
        }
        newStatus = "REJECTED";
        updateData = {
          status: newStatus,
          rejectionReason: body.rejectionReason || null,
        };
        break;

      case "DISPATCH":
        if (stockTransfer.status !== "APPROVED") {
          return NextResponse.json(
            { error: "Stock transfer must be approved before dispatch" },
            { status: 400 }
          );
        }
        newStatus = "DISPATCHED";
        updateData = { status: newStatus };
        break;

      case "RECEIVE":
        if (stockTransfer.status !== "DISPATCHED") {
          return NextResponse.json(
            { error: "Stock transfer must be dispatched before receiving" },
            { status: 400 }
          );
        }
        newStatus = "RECEIVED";
        updateData = { status: newStatus };
        // TODO: Update inventory at destination branch
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action. Use 'APPROVE', 'REJECT', 'DISPATCH', or 'RECEIVE'" },
          { status: 400 }
        );
    }

    const updatedSTN = await prisma.stockTransferNote.update({
      where: { id: stnId },
      data: updateData,
      include: {
        lineItems: true,
      },
    });

    return NextResponse.json({
      success: true,
      stockTransfer: updatedSTN,
      message: `Stock transfer ${action.toLowerCase()}d`,
    });
  } catch (error: any) {
    console.error("Stock transfer approval API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
