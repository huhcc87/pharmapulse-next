// Tax Management (GST) Advanced
// GSTR filing integration, tax report generation, HSN management

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

/**
 * Generate GSTR filing data
 */
export async function generateGSTRFilingData(
  tenantId: string,
  period: string, // YYYY-MM
  gstin: string
): Promise<GSTRFilingData> {
  try {
    // Parse period
    const [year, month] = period.split("-");
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    // Get invoices for the period
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: parseInt(tenantId) || 1,
        sellerGstinId: parseInt(gstin) || 1,
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

    const filingData: GSTRFilingData = {
      period,
      gstin,
      invoices: invoices.map((inv) => ({
        invoiceNumber: inv.invoiceNumber || "",
        invoiceDate: inv.invoiceDate,
        customerGstin: inv.buyerGstin || undefined,
        taxableValue: (inv.totalAmountPaise || 0) - (inv.totalCGSTPaise || 0) - (inv.totalSGSTPaise || 0) - (inv.totalIGSTPaise || 0),
        cgst: inv.totalCGSTPaise || 0,
        sgst: inv.totalSGSTPaise || 0,
        igst: inv.totalIGSTPaise || 0,
        totalTax: (inv.totalCGSTPaise || 0) + (inv.totalSGSTPaise || 0) + (inv.totalIGSTPaise || 0),
      })),
    };

    return filingData;
  } catch (error: any) {
    console.error("Generate GSTR filing data error:", error);
    throw error;
  }
}

/**
 * Submit GSTR filing (placeholder - would integrate with GST portal)
 */
export async function submitGSTRFiling(
  tenantId: string,
  filingData: GSTRFilingData
): Promise<{
  success: boolean;
  filingId?: string;
  message: string;
}> {
  try {
    // In a real implementation, this would:
    // 1. Format data according to GST portal requirements
    // 2. Submit to GST portal API
    // 3. Handle authentication/authorization
    // 4. Return filing acknowledgment

    // For now, return a placeholder response
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
    // Parse period
    const [year, month] = period.split("-");
    const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

    const where: any = {
      tenantId: parseInt(tenantId) || 1,
      invoiceDate: {
        gte: startDate,
        lte: endDate,
      },
      status: {
        in: ["ISSUED", "FILED"],
      },
    };

    if (gstin) {
      where.sellerGstinId = parseInt(gstin);
    }

    // Get invoices
    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        lineItems: true,
      },
    });

    // Calculate totals
    let totalTaxableValue = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    // HSN breakdown
    const hsnBreakdown: Record<string, {
      taxableValue: number;
      cgst: number;
      sgst: number;
      igst: number;
    }> = {};

    for (const invoice of invoices) {
      totalTaxableValue += (invoice.totalAmountPaise || 0) - (invoice.totalCGSTPaise || 0) - (invoice.totalSGSTPaise || 0) - (invoice.totalIGSTPaise || 0);
      totalCGST += invoice.totalCGSTPaise || 0;
      totalSGST += invoice.totalSGSTPaise || 0;
      totalIGST += invoice.totalIGSTPaise || 0;

      // HSN breakdown
      for (const lineItem of invoice.lineItems) {
        const hsn = lineItem.hsnCode || "UNKNOWN";
        if (!hsnBreakdown[hsn]) {
          hsnBreakdown[hsn] = {
            taxableValue: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
          };
        }

        const lineTaxable = (lineItem.lineTotalPaise || 0) - (lineItem.cgstPaise || 0) - (lineItem.sgstPaise || 0) - (lineItem.igstPaise || 0);
        hsnBreakdown[hsn].taxableValue += lineTaxable;
        hsnBreakdown[hsn].cgst += lineItem.cgstPaise || 0;
        hsnBreakdown[hsn].sgst += lineItem.sgstPaise || 0;
        hsnBreakdown[hsn].igst += lineItem.igstPaise || 0;
      }
    }

    const report: TaxReportData = {
      period,
      totalTaxableValue,
      totalCGST,
      totalSGST,
      totalIGST,
      totalTax: totalCGST + totalSGST + totalIGST,
      invoiceCount: invoices.length,
      breakdown: Object.entries(hsnBreakdown).map(([hsnCode, data]) => ({
        hsnCode,
        ...data,
      })),
    };

    return report;
  } catch (error: any) {
    console.error("Generate tax report error:", error);
    throw error;
  }
}
