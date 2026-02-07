// API endpoint to cancel E-Way Bill
// POST /api/invoices/[id]/e-waybill/cancel

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { cancelEWayBill } from "@/lib/invoice/e-waybill";

const prisma = new PrismaClient();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const invoiceId = parseInt(resolvedParams.id);
    const body = await req.json();
    const { cancelReason, remark } = body;

    // Validate cancel reason (1-4 as per GST rules)
    if (!cancelReason || cancelReason < 1 || cancelReason > 4) {
      return NextResponse.json(
        { error: "cancelReason must be between 1-4 (1=Data Entry Error, 2=Duplicate, 3=Order Cancelled, 4=Others)" },
        { status: 400 }
      );
    }

    if (!remark) {
      return NextResponse.json(
        { error: "remark is required" },
        { status: 400 }
      );
    }

    // Fetch invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    if (!invoice.eWayBillNumber) {
      return NextResponse.json(
        { error: "E-Way Bill number not found. Invoice may not have E-Way Bill generated." },
        { status: 400 }
      );
    }

    if (invoice.eWayBillStatus === "CANCELLED") {
      return NextResponse.json(
        { error: "E-Way Bill already cancelled" },
        { status: 400 }
      );
    }

    // Cancel E-Way Bill
    const result = await cancelEWayBill({
      ewbNo: invoice.eWayBillNumber,
      cancelReason,
      remark,
    });

    if (!result.success) {
      // Update invoice with error status
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          eWayBillStatus: "FAILED",
          eWayBillError: result.error || "Cancellation failed",
        },
      });

      return NextResponse.json(
        { 
          error: result.error || "E-Way Bill cancellation failed",
          errorCode: result.errorCode,
        },
        { status: 500 }
      );
    }

    // Update invoice with cancelled status
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        eWayBillStatus: "CANCELLED",
        eWayBillError: null,
      },
    });

    return NextResponse.json({
      success: true,
      invoice: {
        id: updatedInvoice.id,
        invoiceNumber: updatedInvoice.invoiceNumber,
        eWayBillStatus: updatedInvoice.eWayBillStatus,
      },
    });
  } catch (error: any) {
    console.error("E-Way Bill cancellation API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
