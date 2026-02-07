// API endpoint to generate E-Way Bill
// POST /api/invoices/[id]/e-waybill/generate

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { generateEWayBill } from "@/lib/invoice/e-waybill";

const prisma = new PrismaClient();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const invoiceId = parseInt(resolvedParams.id);
    const body = await req.json();
    const { vehicleNumber, distance, transportMode, transporterGstin, transporterName, transporterDocNo, transporterDocDate } = body;

    // Validate required fields
    if (!vehicleNumber) {
      return NextResponse.json(
        { error: "vehicleNumber is required" },
        { status: 400 }
      );
    }

    if (!distance || distance <= 0) {
      return NextResponse.json(
        { error: "distance must be greater than 0" },
        { status: 400 }
      );
    }

    if (!transportMode || !["Road", "Rail", "Air", "Ship"].includes(transportMode)) {
      return NextResponse.json(
        { error: "transportMode must be one of: Road, Rail, Air, Ship" },
        { status: 400 }
      );
    }

    // Fetch invoice with line items
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lineItems: true,
        sellerOrg: true,
        sellerGstin: true,
        customer: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Check if invoice is issued
    if (invoice.status !== "ISSUED") {
      return NextResponse.json(
        { error: "E-Way Bill can only be generated for issued invoices" },
        { status: 400 }
      );
    }

    // Check if E-Way Bill already generated
    if (invoice.eWayBillNumber) {
      return NextResponse.json(
        { 
          error: "E-Way Bill already generated",
          ewbNo: invoice.eWayBillNumber,
          validUpto: invoice.eWayBillValidUpto,
        },
        { status: 400 }
      );
    }

    // Check invoice value for E-Way Bill requirement
    const invoiceValue = invoice.totalInvoicePaise / 100;
    const isInterState = invoice.supplyType === "INTER_STATE";

    // E-Way Bill required if inter-state >₹50,000
    if (!isInterState && invoiceValue <= 50000) {
      return NextResponse.json(
        { 
          error: "E-Way Bill not required for intra-state invoices ≤₹50,000",
          note: "E-Way Bill is required for inter-state movement >₹50,000 or intra-state movement >₹50,000 (state-dependent)",
        },
        { status: 400 }
      );
    }

    // Generate E-Way Bill
    const result = await generateEWayBill({
      invoice,
      invoiceLineItems: invoice.lineItems,
      vehicleNumber,
      distance,
      transportMode,
      transporterGstin,
      transporterName,
      transporterDocNo,
      transporterDocDate: transporterDocDate ? new Date(transporterDocDate) : undefined,
    });

    if (!result.success) {
      // Update invoice with error status
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          eWayBillStatus: "FAILED",
          eWayBillError: result.error || "Unknown error",
        },
      });

      return NextResponse.json(
        { 
          error: result.error || "E-Way Bill generation failed",
          errorCode: result.errorCode,
        },
        { status: 500 }
      );
    }

    // Update invoice with E-Way Bill data
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        eWayBillNumber: result.ewbNo,
        eWayBillValidUpto: result.validUpto || new Date(),
        transporterGstin: transporterGstin || null,
        vehicleNumber: vehicleNumber,
        distance: distance,
        eWayBillStatus: "GENERATED",
        eWayBillError: null,
      },
    });

    return NextResponse.json({
      success: true,
      invoice: {
        id: updatedInvoice.id,
        invoiceNumber: updatedInvoice.invoiceNumber,
        eWayBillNumber: updatedInvoice.eWayBillNumber,
        eWayBillValidUpto: updatedInvoice.eWayBillValidUpto,
        vehicleNumber: updatedInvoice.vehicleNumber,
        distance: updatedInvoice.distance,
        eWayBillStatus: updatedInvoice.eWayBillStatus,
      },
    });
  } catch (error: any) {
    console.error("E-Way Bill generation API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
