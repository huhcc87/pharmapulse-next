// API endpoint to cancel E-Invoice IRN
// POST /api/invoices/[id]/e-invoice/cancel

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { cancelEInvoiceIRN } from "@/lib/invoice/e-invoice-nic";

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

    if (!cancelReason || !remark) {
      return NextResponse.json(
        { error: "cancelReason and remark are required" },
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

    if (!invoice.eInvoiceIrn) {
      return NextResponse.json(
        { error: "E-Invoice IRN not found. Invoice may not have E-Invoice generated." },
        { status: 400 }
      );
    }

    if (invoice.eInvoiceStatus === "CANCELLED") {
      return NextResponse.json(
        { error: "E-Invoice already cancelled" },
        { status: 400 }
      );
    }

    // Cancel E-Invoice IRN
    const result = await cancelEInvoiceIRN({
      irn: invoice.eInvoiceIrn,
      cancelReason,
      remark,
    });

    if (!result.success) {
      // Update invoice with error status
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          eInvoiceStatus: "FAILED",
          eInvoiceError: result.error || "Cancellation failed",
        },
      });

      return NextResponse.json(
        { 
          error: result.error || "E-Invoice cancellation failed",
          errorCode: result.errorCode,
        },
        { status: 500 }
      );
    }

    // Update invoice with cancelled status
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        eInvoiceStatus: "CANCELLED",
        eInvoiceError: null,
        // Also cancel invoice status if needed
        status: "CANCELLED",
      },
    });

    return NextResponse.json({
      success: true,
      invoice: {
        id: updatedInvoice.id,
        invoiceNumber: updatedInvoice.invoiceNumber,
        eInvoiceStatus: updatedInvoice.eInvoiceStatus,
      },
    });
  } catch (error: any) {
    console.error("E-Invoice cancellation API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
