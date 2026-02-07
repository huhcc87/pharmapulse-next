import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/invoices/test-create - Test invoice creation
export async function GET() {
  try {
    // Check if GSTIN exists
    const gstin = await prisma.orgGstin.findFirst({
      where: { isActive: true },
    });

    if (!gstin) {
      return NextResponse.json({
        error: "No active GSTIN found",
        fix: "Run: curl -X POST http://localhost:3000/api/gst/setup-default",
      });
    }

    // Check if we can create an invoice
    const testInvoice = await prisma.invoice.create({
      data: {
        tenantId: 1,
        sellerOrgId: gstin.orgId,
        sellerGstinId: gstin.id,
        buyerName: "Test Buyer",
        invoiceType: "B2C",
        status: "DRAFT",
        totalTaxablePaise: 10000,
        totalGstPaise: 1200,
        totalInvoicePaise: 11200,
        lineItems: {
          create: {
            productName: "Test Product",
            quantity: 1,
            unitPricePaise: 10000,
            taxablePaise: 10000,
            gstRateBps: 1200,
            cgstPaise: 600,
            sgstPaise: 600,
            igstPaise: 0,
          },
        },
      },
      include: { lineItems: true },
    });

    // Clean up test invoice
    await prisma.invoice.delete({ where: { id: testInvoice.id } });

    return NextResponse.json({
      success: true,
      message: "Invoice creation works!",
      gstin: {
        id: gstin.id,
        gstin: gstin.gstin,
      },
    });
  } catch (error: any) {
    console.error("Test invoice creation error:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to create test invoice",
        details: error,
      },
      { status: 500 }
    );
  }
}

