// TCS Certificate Generation (Form 27D)
// Generates TCS certificate for customers

import { prisma } from "@/lib/prisma";

export interface TCSCertificateInput {
  customerId: number;
  financialYear: string; // "2024-25"
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  tenantId?: number;
}

export interface TCSCertificateResult {
  success: boolean;
  certificateNumber?: string;
  totalTCSCollectedPaise?: number;
  certificateData?: any;
  error?: string;
}

/**
 * Generate TCS Certificate (Form 27D)
 * 
 * Form 27D contains:
 * - Certificate number
 * - Customer details (name, PAN, address)
 * - Financial year and quarter
 * - Total TCS collected in the quarter
 * - TCS rate applied
 * - Date of issue
 */
export async function generateTCSCertificate(
  input: TCSCertificateInput
): Promise<TCSCertificateResult> {
  try {
    const { customerId, financialYear, quarter, tenantId = 1 } = input;

    // Fetch customer
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return {
        success: false,
        error: "Customer not found",
      };
    }

    // Calculate quarter date range
    const quarterDates = getQuarterDates(financialYear, quarter);
    
    // Fetch invoices with TCS for this customer in the quarter
    // Note: TCS fields need to be added to Invoice schema
    // For now, this is a placeholder implementation
    const invoices = await prisma.invoice.findMany({
      where: {
        customerId,
        tenantId,
        invoiceDate: {
          gte: quarterDates.start,
          lte: quarterDates.end,
        },
        status: "ISSUED",
        invoiceType: "B2B",
        // tcsAmountPaise: { gt: 0 }, // Will work once TCS fields are added
      },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        totalInvoicePaise: true,
        // tcsAmountPaise: true, // Will work once TCS fields are added
      },
    });

    // Calculate total TCS collected (placeholder - will use actual TCS field once added)
    let totalTCSCollectedPaise = 0;
    // invoices.forEach((inv) => {
    //   totalTCSCollectedPaise += inv.tcsAmountPaise || 0;
    // });

    // Generate certificate number
    const certificateNumber = await generateCertificateNumber(tenantId, financialYear, quarter);

    // Build certificate data
    const certificateData = {
      certificateNumber,
      financialYear,
      quarter,
      issueDate: new Date(),
      customer: {
        name: customer.name,
        gstin: customer.gstin || null,
        address: customer.billingAddress || null,
        stateCode: customer.stateCode || null,
        pincode: customer.billingPincode || null,
      },
      tcsDetails: {
        totalTCSCollectedPaise,
        totalTCSCollectedRupees: (totalTCSCollectedPaise / 100).toFixed(2),
        invoiceCount: invoices.length,
        invoices: invoices.map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          // tcsAmountPaise: inv.tcsAmountPaise || 0,
        })),
      },
    };

    return {
      success: true,
      certificateNumber,
      totalTCSCollectedPaise,
      certificateData,
    };
  } catch (error: any) {
    console.error("TCS certificate generation error:", error);
    return {
      success: false,
      error: error.message || "TCS certificate generation failed",
    };
  }
}

/**
 * Get quarter date range
 */
function getQuarterDates(fy: string, quarter: string): { start: Date; end: Date } {
  const [startYear] = fy.split("-");
  const year = parseInt(startYear);
  
  let startMonth = 3; // April (0-indexed: 3)
  let endMonth = 5; // June (0-indexed: 5)
  
  if (quarter === "Q2") {
    startMonth = 6; // July
    endMonth = 8; // September
  } else if (quarter === "Q3") {
    startMonth = 9; // October
    endMonth = 11; // December
  } else if (quarter === "Q4") {
    startMonth = 0; // January (next year)
    endMonth = 2; // March (next year)
  }
  
  const start = new Date(year, startMonth, 1);
  const end = new Date(quarter === "Q4" ? year + 1 : year, endMonth + 1, 0, 23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Generate TCS certificate number
 * Format: TCS/FY/QX/0001
 */
async function generateCertificateNumber(
  tenantId: number,
  financialYear: string,
  quarter: string
): Promise<string> {
  const prefix = `TCS/${financialYear}/${quarter}`;
  
  // In production, query database for last certificate number
  // For now, generate based on timestamp
  const timestamp = Date.now();
  const sequence = String(timestamp).slice(-4);
  
  return `${prefix}/${sequence}`;
}
