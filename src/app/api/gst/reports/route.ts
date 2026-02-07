import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sellerOrgId, periodStart, periodEnd } = body;

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "periodStart and periodEnd are required" },
        { status: 400 }
      );
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    endDate.setHours(23, 59, 59, 999); // Include full end date

    // Fetch invoices for the period
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: DEMO_TENANT_ID,
        sellerOrgId: sellerOrgId || undefined,
        invoiceDate: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ["ISSUED", "FILED"],
        },
      },
      include: {
        lineItems: true,
        taxLines: true,
      },
    });

    // Calculate totals
    let totalTaxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalGst = 0;
    let totalInvoice = 0;

    const b2bTotals = {
      taxable: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      gst: 0,
      invoice: 0,
      count: 0,
    };

    const b2cTotals = {
      taxable: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      gst: 0,
      invoice: 0,
      count: 0,
    };

    const stateWise: Record<string, any> = {};
    const hsnWise: Record<string, any> = {};

    invoices.forEach((inv) => {
      totalTaxable += inv.totalTaxablePaise;
      totalGst += inv.totalGstPaise;
      totalInvoice += inv.totalInvoicePaise;

      // Tax breakdown
      inv.taxLines.forEach((tax) => {
        if (tax.taxType === "CGST") totalCgst += tax.taxPaise;
        if (tax.taxType === "SGST") totalSgst += tax.taxPaise;
        if (tax.taxType === "IGST") totalIgst += tax.taxPaise;
      });

      // B2B vs B2C
      if (inv.invoiceType === "B2B") {
        b2bTotals.taxable += inv.totalTaxablePaise;
        b2bTotals.gst += inv.totalGstPaise;
        b2bTotals.invoice += inv.totalInvoicePaise;
        b2bTotals.count += 1;
        inv.taxLines.forEach((tax) => {
          if (tax.taxType === "CGST") b2bTotals.cgst += tax.taxPaise;
          if (tax.taxType === "SGST") b2bTotals.sgst += tax.taxPaise;
          if (tax.taxType === "IGST") b2bTotals.igst += tax.taxPaise;
        });
      } else {
        b2cTotals.taxable += inv.totalTaxablePaise;
        b2cTotals.gst += inv.totalGstPaise;
        b2cTotals.invoice += inv.totalInvoicePaise;
        b2cTotals.count += 1;
        inv.taxLines.forEach((tax) => {
          if (tax.taxType === "CGST") b2cTotals.cgst += tax.taxPaise;
          if (tax.taxType === "SGST") b2cTotals.sgst += tax.taxPaise;
          if (tax.taxType === "IGST") b2cTotals.igst += tax.taxPaise;
        });
      }

      // State-wise
      const state = inv.placeOfSupply || "UNKNOWN";
      if (!stateWise[state]) {
        stateWise[state] = {
          taxable: 0,
          gst: 0,
          invoice: 0,
          count: 0,
        };
      }
      stateWise[state].taxable += inv.totalTaxablePaise;
      stateWise[state].gst += inv.totalGstPaise;
      stateWise[state].invoice += inv.totalInvoicePaise;
      stateWise[state].count += 1;

      // HSN-wise
      inv.lineItems.forEach((item) => {
        const hsn = item.hsnCode || "UNKNOWN";
        if (!hsnWise[hsn]) {
          hsnWise[hsn] = {
            taxable: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            gst: 0,
            quantity: 0,
            count: 0,
          };
        }
        hsnWise[hsn].taxable += item.taxablePaise;
        hsnWise[hsn].cgst += item.cgstPaise;
        hsnWise[hsn].sgst += item.sgstPaise;
        hsnWise[hsn].igst += item.igstPaise;
        hsnWise[hsn].gst +=
          item.cgstPaise + item.sgstPaise + item.igstPaise;
        hsnWise[hsn].quantity += item.quantity;
        hsnWise[hsn].count += 1;
      });
    });

    const report = {
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      totals: {
        taxable: totalTaxable,
        cgst: totalCgst,
        sgst: totalSgst,
        igst: totalIgst,
        gst: totalGst,
        invoice: totalInvoice,
        count: invoices.length,
      },
      b2bTotals: {
        ...b2bTotals,
        taxable: b2bTotals.taxable,
        gst: b2bTotals.gst,
        invoice: b2bTotals.invoice,
      },
      b2cTotals: {
        ...b2cTotals,
        taxable: b2cTotals.taxable,
        gst: b2cTotals.gst,
        invoice: b2cTotals.invoice,
      },
      stateWise,
      hsnWise,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(report);
  } catch (error: any) {
    console.error("Error generating GST report:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate report" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const sellerOrgId = searchParams.get("sellerOrgId");
    const periodStart = searchParams.get("periodStart");
    const periodEnd = searchParams.get("periodEnd");

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "periodStart and periodEnd query parameters are required" },
        { status: 400 }
      );
    }

    // Reuse POST logic
    const body = {
      sellerOrgId: sellerOrgId ? parseInt(sellerOrgId) : undefined,
      periodStart,
      periodEnd,
    };

    const reqWithBody = new Request(req.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return POST(reqWithBody);
  } catch (error: any) {
    console.error("Error fetching GST report:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch report" },
      { status: 500 }
    );
  }
}










