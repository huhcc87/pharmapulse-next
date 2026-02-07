import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const sellerOrgId = searchParams.get("sellerOrgId");
    const year = searchParams.get("year") || new Date().getFullYear().toString();

    const yearNum = parseInt(year);
    if (isNaN(yearNum)) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const startDate = new Date(yearNum, 0, 1);
    const endDate = new Date(yearNum, 11, 31, 23, 59, 59, 999);

    // Fetch all invoices for the year
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: DEMO_TENANT_ID,
        sellerOrgId: sellerOrgId ? parseInt(sellerOrgId) : undefined,
        invoiceDate: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ["ISSUED", "FILED"],
        },
      },
      include: {
        lineItems: {
          include: {
            invoice: true,
          },
        },
        taxLines: true,
      },
      orderBy: {
        invoiceDate: "asc",
      },
    });

    // Monthly breakdown
    const monthly: Record<string, any> = {};
    for (let month = 0; month < 12; month++) {
      const monthKey = `${yearNum}-${String(month + 1).padStart(2, "0")}`;
      monthly[monthKey] = {
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        gst: 0,
        invoice: 0,
        count: 0,
      };
    }

    // Annual totals
    let annualTaxable = 0;
    let annualCgst = 0;
    let annualSgst = 0;
    let annualIgst = 0;
    let annualGst = 0;
    let annualInvoice = 0;

    const b2bAnnual = {
      taxable: 0,
      gst: 0,
      invoice: 0,
      count: 0,
    };

    const b2cAnnual = {
      taxable: 0,
      gst: 0,
      invoice: 0,
      count: 0,
    };

    const topHsn: Record<string, number> = {};
    const topProducts: Record<string, number> = {};
    const stateWise: Record<string, any> = {};

    invoices.forEach((inv) => {
      const monthKey = `${yearNum}-${String(inv.invoiceDate.getMonth() + 1).padStart(2, "0")}`;
      
      if (monthly[monthKey]) {
        monthly[monthKey].taxable += inv.totalTaxablePaise;
        monthly[monthKey].invoice += inv.totalInvoicePaise;
        monthly[monthKey].count += 1;
      }

      annualTaxable += inv.totalTaxablePaise;
      annualInvoice += inv.totalInvoicePaise;

      inv.taxLines.forEach((tax) => {
        if (tax.taxType === "CGST") {
          annualCgst += tax.taxPaise;
          if (monthly[monthKey]) monthly[monthKey].cgst += tax.taxPaise;
        }
        if (tax.taxType === "SGST") {
          annualSgst += tax.taxPaise;
          if (monthly[monthKey]) monthly[monthKey].sgst += tax.taxPaise;
        }
        if (tax.taxType === "IGST") {
          annualIgst += tax.taxPaise;
          if (monthly[monthKey]) monthly[monthKey].igst += tax.taxPaise;
        }
      });

      annualGst += inv.totalGstPaise;
      if (monthly[monthKey]) monthly[monthKey].gst += inv.totalGstPaise;

      // B2B vs B2C
      if (inv.invoiceType === "B2B") {
        b2bAnnual.taxable += inv.totalTaxablePaise;
        b2bAnnual.gst += inv.totalGstPaise;
        b2bAnnual.invoice += inv.totalInvoicePaise;
        b2bAnnual.count += 1;
      } else {
        b2cAnnual.taxable += inv.totalTaxablePaise;
        b2cAnnual.gst += inv.totalGstPaise;
        b2cAnnual.invoice += inv.totalInvoicePaise;
        b2cAnnual.count += 1;
      }

      // Top HSN codes
      inv.lineItems.forEach((item) => {
        const hsn = item.hsnCode || "UNKNOWN";
        topHsn[hsn] = (topHsn[hsn] || 0) + item.taxablePaise;
      });

      // Top products
      inv.lineItems.forEach((item) => {
        const product = item.productName;
        topProducts[product] = (topProducts[product] || 0) + item.taxablePaise;
      });

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
    });

    // Sort top HSN and products
    const topHsnList = Object.entries(topHsn)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([hsn, taxable]) => ({ hsn, taxable }));

    const topProductsList = Object.entries(topProducts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([product, taxable]) => ({ product, taxable }));

    const summary = {
      year: yearNum,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      annual: {
        taxable: annualTaxable,
        cgst: annualCgst,
        sgst: annualSgst,
        igst: annualIgst,
        gst: annualGst,
        invoice: annualInvoice,
        count: invoices.length,
      },
      monthly,
      b2b: b2bAnnual,
      b2c: b2cAnnual,
      topHsn: topHsnList,
      topProducts: topProductsList,
      stateWise,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error("Error generating year-end summary:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate summary" },
      { status: 500 }
    );
  }
}










