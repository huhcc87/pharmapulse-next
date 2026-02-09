// src/lib/billing/tax-management.ts
// Tax Management (GST) Advanced
// GSTR filing integration, tax report generation, HSN management

import { prisma } from "@/lib/prisma";

export interface GSTRFilingData {
  period: string; // YYYY-MM format
  gstin: string;
  invoices: Array<{
    invoiceNumber: string;
    invoiceDate: Date;
    customerGstin?: string;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalTax: number;
  }>;
}

export interface TaxReportData {
  period: string;
  totalTaxableValue: number;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalTax: number;
  invoiceCount: number;
  breakdown: Array<{
    hsnCode: string;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
  }>;
}

function parsePeriod(period: string): { startDate: Date; endDate: Date } {
  const [y, m] = period.split("-");
  const year = Number.parseInt(y, 10);
  const month = Number.parseInt(m, 10); // 1..12

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error(`Invalid period format. Expected YYYY-MM, got: ${period}`);
  }

  // monthIndex: 0..11
  const monthIndex = month - 1;

  const startDate = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  // last day of the target month: day=0 of next month
  const endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

  return { startDate, endDate };
}

function sumInvoiceFromLineItems(lineItems: any[]): {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
} {
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let gross = 0;

  for (const li of lineItems ?? []) {
    const lineTotal = Number(li?.lineTotalPaise ?? 0);
    const liCgst = Number(li?.cgstPaise ?? 0);
    const liSgst = Number(li?.sgstPaise ?? 0);
    const liIgst = Number(li?.igstPaise ?? 0);

    gross += lineTotal;
    cgst += liCgst;
    sgst += liSgst;
    igst += liIgst;
  }

  const totalTax = cgst + sgst + igst;
  const taxableValue = gross - totalTax;

  return { taxableValue, cgst, sgst, igst, totalTax };
}

/**
 * Generate GSTR filing data
 */
export async function generateGSTRFilingData(
  tenantId: string,
  period: string, // YYYY-MM
  gstin: string
): Promise<GSTRFilingData> {
  try {
    const { startDate, endDate } = parsePeriod(period);

    // NOTE: gstin is being used as sellerGstinId in your original code (numeric).
    // Keeping same behavior but making it safe.
    const numericTenantId = Number.parseInt(tenantId, 10);
    const numericGstinId = Number.parseInt(gstin, 10);

    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: Number.isFinite(numericTenantId) ? numericTenantId : 1,
        ...(Number.isFinite(numericGstinId) ? { sellerGstinId: numericGstinId } : {}),
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
        customer: true,
      },
    });

    return {
      period,
      gstin,
      invoices: invoices.map((inv) => {
        const totals = sumInvoiceFromLineItems(inv.lineItems as any[]);

        return {
          invoiceNumber: inv.invoiceNumber || "",
          invoiceDate: inv.invoiceDate,
          customerGstin: (inv as any).buyerGstin || undefined,
          taxableValue: totals.taxableValue,
          cgst: totals.cgst,
          sgst: totals.sgst,
          igst: totals.igst,
          totalTax: totals.totalTax,
        };
      }),
    };
  } catch (error: any) {
    console.error("Generate GSTR filing data error:", error);
    throw error;
  }
}

/**
 * Submit GSTR filing (placeholder - would integrate with GST portal)
 */
export async function submitGSTRFiling(
  _tenantId: string,
  filingData: GSTRFilingData
): Promise<{
  success: boolean;
  filingId?: string;
  message: string;
}> {
  try {
    return {
      success: true,
      filingId: `GSTR-${filingData.period}-${Date.now()}`,
      message: "GSTR filing submitted successfully (simulated)",
    };
  } catch (error: any) {
    console.error("Submit GSTR filing error:", error);
    throw error;
  }
}

/**
 * Generate tax report
 */
export async function generateTaxReport(
  tenantId: string,
  period: string, // YYYY-MM
  gstin?: string
): Promise<TaxReportData> {
  try {
    const { startDate, endDate } = parsePeriod(period);

    const numericTenantId = Number.parseInt(tenantId, 10);
    const numericGstinId = gstin ? Number.parseInt(gstin, 10) : NaN;

    const where: any = {
      tenantId: Number.isFinite(numericTenantId) ? numericTenantId : 1,
      invoiceDate: { gte: startDate, lte: endDate },
      status: { in: ["ISSUED", "FILED"] },
    };

    if (gstin && Number.isFinite(numericGstinId)) {
      where.sellerGstinId = numericGstinId;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        lineItems: true,
      },
    });

    let totalTaxableValue = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    const hsnBreakdown: Record<
      string,
      { taxableValue: number; cgst: number; sgst: number; igst: number }
    > = {};

    for (const invoice of invoices) {
      const invTotals = sumInvoiceFromLineItems(invoice.lineItems as any[]);
      totalTaxableValue += invTotals.taxableValue;
      totalCGST += invTotals.cgst;
      totalSGST += invTotals.sgst;
      totalIGST += invTotals.igst;

      for (const lineItem of invoice.lineItems as any[]) {
        const hsn = String(lineItem?.hsnCode ?? "UNKNOWN");
        if (!hsnBreakdown[hsn]) {
          hsnBreakdown[hsn] = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0 };
        }

        const lineTotal = Number(lineItem?.lineTotalPaise ?? 0);
        const cgst = Number(lineItem?.cgstPaise ?? 0);
        const sgst = Number(lineItem?.sgstPaise ?? 0);
        const igst = Number(lineItem?.igstPaise ?? 0);

        const lineTaxable = lineTotal - (cgst + sgst + igst);

        hsnBreakdown[hsn].taxableValue += lineTaxable;
        hsnBreakdown[hsn].cgst += cgst;
        hsnBreakdown[hsn].sgst += sgst;
        hsnBreakdown[hsn].igst += igst;
      }
    }

    return {
      period,
      totalTaxableValue,
      totalCGST,
      totalSGST,
      totalIGST,
      totalTax: totalCGST + totalSGST + totalIGST,
      invoiceCount: invoices.length,
      breakdown: Object.entries(hsnBreakdown).map(([hsnCode, data]) => ({
        hsnCode,
        taxableValue: data.taxableValue,
        cgst: data.cgst,
        sgst: data.sgst,
        igst: data.igst,
      })),
    };
  } catch (error: any) {
    console.error("Generate tax report error:", error);
    throw error;
  }
}
