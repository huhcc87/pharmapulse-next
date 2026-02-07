// API endpoint to generate E-Way Bill
// POST /api/invoices/[id]/e-way-bill/generate

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateEWayBill } from "@/lib/invoice/e-way-bill";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const resolvedParams = await params;
    const invoiceId = parseInt(resolvedParams.id);
    const body = await req.json();
    const { transporterGstin, vehicleNumber, distance, transportMode } = body;

    // Fetch invoice with related data
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        sellerGstin: true,
        lineItems: true,
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
          eWayBillNumber: invoice.eWayBillNumber,
          eWayBillValidUpto: invoice.eWayBillValidUpto,
        },
        { status: 400 }
      );
    }

    // Generate E-Way Bill
    const result = await generateEWayBill({
      invoice,
      transporterGstin,
      vehicleNumber,
      distance,
      transportMode,
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
        { error: result.error || "E-Way Bill generation failed" },
        { status: 500 }
      );
    }

    // Update invoice with E-Way Bill data
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        eWayBillNumber: result.eWayBillNumber,
        eWayBillValidUpto: result.eWayBillValidUpto,
        transporterGstin: transporterGstin || null,
        vehicleNumber: vehicleNumber || null,
        distance: distance || null,
        eWayBillStatus: "GENERATED",
        eWayBillError: null,
      },
    });

    return NextResponse.json({
      success: true,
      eWayBill: {
        eWayBillNumber: updatedInvoice.eWayBillNumber,
        eWayBillValidUpto: updatedInvoice.eWayBillValidUpto,
        qrCode: result.qrCode,
        transporterGstin: updatedInvoice.transporterGstin,
        vehicleNumber: updatedInvoice.vehicleNumber,
        distance: updatedInvoice.distance,
        status: updatedInvoice.eWayBillStatus,
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
