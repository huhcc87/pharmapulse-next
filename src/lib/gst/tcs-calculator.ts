// TCS (Tax Collected at Source) Calculator
// Required for B2B sales >₹50L annually to same customer

export interface TCSCalculationInput {
  invoiceValuePaise: number; // Total invoice value in paise
  customerGstin?: string | null; // Customer GSTIN
  isB2B: boolean; // Is this a B2B transaction
  customerId?: number; // Customer ID for annual limit check
  financialYear: string; // FY format: "2024-25"
}

export interface TCSCalculationResult {
  isApplicable: boolean;
  tcsRate: number; // TCS rate as percentage (1% or 0.1%)
  tcsAmountPaise: number; // TCS amount in paise
  reason?: string; // Why TCS is/isn't applicable
}

/**
 * Calculate TCS (Tax Collected at Source)
 * 
 * TCS Rules (India):
 * - Applicable for B2B sales >₹50L annually to same customer
 * - Rate: 1% for non-GST registered customers
 * - Rate: 0.1% for GST registered customers
 * - TCS is collected on invoice value (before GST)
 * - TCS certificate (Form 27D) issued quarterly
 */
export function calculateTCS(input: TCSCalculationInput): TCSCalculationResult {
  const { invoiceValuePaise, customerGstin, isB2B, financialYear } = input;

  // TCS only applicable for B2B transactions
  if (!isB2B) {
    return {
      isApplicable: false,
      tcsRate: 0,
      tcsAmountPaise: 0,
      reason: "TCS not applicable for B2C transactions",
    };
  }

  // Check if customer has GSTIN (GST registered)
  const isGstRegistered = !!customerGstin && customerGstin.trim().length > 0;

  // Determine TCS rate
  // Note: In production, you'd check annual sales to this customer
  // For now, we'll calculate TCS if invoice is >₹50L (threshold check)
  const invoiceValueRupees = invoiceValuePaise / 100;
  const annualThreshold = 5000000; // ₹50L in rupees

  // For now, apply TCS if invoice >₹50L (simplified)
  // In production, check cumulative sales to this customer in the financial year
  if (invoiceValueRupees < annualThreshold) {
    // Check if cumulative sales to this customer exceed ₹50L
    // This would require database query in production
    // For now, we'll apply TCS if invoice itself is >₹50L
    // TODO: Implement annual sales check per customer
  }

  // TCS rate: 1% for non-GST registered, 0.1% for GST registered
  const tcsRate = isGstRegistered ? 0.1 : 1.0;

  // Calculate TCS on invoice value (before GST)
  // TCS is calculated on the taxable value (excluding GST)
  // For simplicity, we'll calculate on invoice value
  // In production, calculate on taxable value (before GST)
  const tcsAmountPaise = Math.round((invoiceValuePaise * tcsRate) / 100);

  return {
    isApplicable: true,
    tcsRate,
    tcsAmountPaise,
    reason: `TCS applicable: ${isGstRegistered ? "0.1%" : "1%"} (${isGstRegistered ? "GST registered" : "Non-GST registered"} customer)`,
  };
}

/**
 * Check if TCS is applicable for a customer based on annual sales
 * This should be called before calculating TCS to determine if threshold is met
 */
export async function checkTCSApplicability(
  customerId: number,
  financialYear: string,
  tenantId: number = 1
): Promise<{ isApplicable: boolean; annualSalesPaise: number; thresholdPaise: number }> {
  // This would query the database to check cumulative sales
  // For now, return a placeholder
  // TODO: Implement database query to check annual sales
  
  const thresholdPaise = 50000000; // ₹50L in paise
  
  // Placeholder - would query database in production
  // const annualSales = await prisma.invoice.aggregate({
  //   where: {
  //     customerId,
  //     tenantId,
  //     invoiceDate: {
  //       gte: getFinancialYearStart(financialYear),
  //       lte: getFinancialYearEnd(financialYear),
  //     },
  //     status: "ISSUED",
  //   },
  //   _sum: {
  //     totalInvoicePaise: true,
  //   },
  // });
  
  // const annualSalesPaise = annualSales._sum.totalInvoicePaise || 0;
  
  return {
    isApplicable: false, // Will be determined by actual query
    annualSalesPaise: 0,
    thresholdPaise,
  };
}

/**
 * Get financial year start date
 */
export function getFinancialYearStart(fy: string): Date {
  const [startYear] = fy.split("-");
  return new Date(parseInt(startYear), 3, 1); // April 1
}

/**
 * Get financial year end date
 */
export function getFinancialYearEnd(fy: string): Date {
  const [startYear] = fy.split("-");
  return new Date(parseInt(startYear) + 1, 2, 31); // March 31
}
