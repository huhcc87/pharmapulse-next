// API endpoint to generate E-Invoice IRN
// POST /api/invoices/[id]/e-invoice/generate

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { generateEInvoiceIRN } from "@/lib/invoice/e-invoice-nic";

const prisma = new PrismaClient();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const invoiceId = parseInt(resolvedParams.id);

    // Fetch invoice with related data
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        sellerOrg: true,
        sellerGstin: true,
        customer: true,
        lineItems: true,
        prescription: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Check if invoice is already issued
    if (invoice.status !== "ISSUED") {
      return NextResponse.json(
        { error: "E-Invoice can only be generated for issued invoices" },
        { status: 400 }
      );
    }

    // Check if E-Invoice already generated
    if (invoice.eInvoiceIrn) {
      return NextResponse.json(
        { 
          error: "E-Invoice already generated",
          irn: invoice.eInvoiceIrn,
          qrCode: invoice.eInvoiceQrCode,
          ackNo: invoice.eInvoiceAckNo,
          ackDate: invoice.eInvoiceAckDate,
        },
        { status: 400 }
      );
    }

    // Generate E-Invoice IRN
    const result = await generateEInvoiceIRN({
      invoice,
      sellerGstin: invoice.sellerGstin,
      org: invoice.sellerOrg,
    });

    if (!result.success) {
      // Update invoice with error status
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          eInvoiceStatus: "FAILED",
          eInvoiceError: result.error || "Unknown error",
        },
      });

      return NextResponse.json(
        { 
          error: result.error || "E-Invoice generation failed",
          errorCode: result.errorCode,
        },
        { status: 500 }
      );
    }

    // Update invoice with E-Invoice data
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        eInvoiceIrn: result.irn,
        eInvoiceQrCode: result.qrCode,
        eInvoiceAckNo: result.ackNo,
        eInvoiceAckDate: result.ackDate || new Date(),
        eInvoiceStatus: "GENERATED",
        eInvoiceError: null,
        // Update eInvoicePayload with generated data
        eInvoicePayload: {
          ...(invoice.eInvoicePayload as any || {}),
          Irn: result.irn,
          QRCode: result.qrCode,
          AckNo: result.ackNo,
          AckDt: result.ackDate?.toISOString(),
        },
      },
    });

    return NextResponse.json({
      success: true,
      invoice: {
        id: updatedInvoice.id,
        invoiceNumber: updatedInvoice.invoiceNumber,
        eInvoiceIrn: updatedInvoice.eInvoiceIrn,
        eInvoiceQrCode: updatedInvoice.eInvoiceQrCode,
        eInvoiceAckNo: updatedInvoice.eInvoiceAckNo,
        eInvoiceAckDate: updatedInvoice.eInvoiceAckDate,
        eInvoiceStatus: updatedInvoice.eInvoiceStatus,
      },
    });
  } catch (error: any) {
    console.error("E-Invoice generation API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
