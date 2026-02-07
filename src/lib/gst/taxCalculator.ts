// src/lib/gst/taxCalculator.ts
// Indian GST tax calculation utilities

export type GstType = "INCLUSIVE" | "EXCLUSIVE";

export interface TaxCalculationInput {
  pricePaise: number; // Price in paise
  gstRate: number; // GST rate as percentage (e.g., 12 for 12%)
  gstType: GstType;
  quantity?: number;
  discountPaise?: number;
  discountPercent?: number;
}

export interface TaxCalculationResult {
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalGstPaise: number;
  lineTotalPaise: number;
}

/**
 * Calculate GST for a line item (India logic)
 * - If GST INCLUSIVE: taxable = price / (1 + gstRate/100)
 * - If GST EXCLUSIVE: taxable = price
 * - CGST = taxable * gstRate/2 / 100
 * - SGST = taxable * gstRate/2 / 100
 */
export function calculateGst(input: TaxCalculationInput): TaxCalculationResult {
  const { pricePaise, gstRate, gstType, quantity = 1, discountPaise = 0, discountPercent } = input;

  // Calculate line total before discount
  let lineTotalBeforeDiscount = pricePaise * quantity;

  // Apply discount
  let discountAmount = discountPaise;
  if (discountPercent !== undefined && discountPercent > 0) {
    discountAmount = Math.round((lineTotalBeforeDiscount * discountPercent) / 100);
  }

  const lineTotalAfterDiscount = lineTotalBeforeDiscount - discountAmount;

  // Calculate taxable value based on GST type
  let taxableValuePaise: number;
  if (gstType === "INCLUSIVE") {
    // GST is included in price: taxable = price / (1 + gstRate/100)
    const gstMultiplier = 1 + gstRate / 100;
    taxableValuePaise = Math.round(lineTotalAfterDiscount / gstMultiplier);
  } else {
    // GST is exclusive: taxable = price
    taxableValuePaise = lineTotalAfterDiscount;
  }

  // Calculate CGST and SGST (half of GST rate each)
  const gstAmountPaise = Math.round((taxableValuePaise * gstRate) / 100);
  const cgstPaise = Math.round(gstAmountPaise / 2);
  const sgstPaise = gstAmountPaise - cgstPaise; // Handle rounding

  // IGST is 0 for intra-state (CGST+SGST), or full GST for inter-state
  const igstPaise = 0; // Will be set based on place of supply

  // Final line total
  const lineTotalPaise =
    gstType === "INCLUSIVE" ? lineTotalAfterDiscount : taxableValuePaise + gstAmountPaise;

  return {
    taxableValuePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalGstPaise: gstAmountPaise,
    lineTotalPaise,
  };
}

/**
 * Calculate totals for multiple line items
 */
export function calculateInvoiceTotals(
  lineItems: TaxCalculationResult[],
  isIntraState: boolean = true
): {
  totalTaxablePaise: number;
  totalCGSTPaise: number;
  totalSGSTPaise: number;
  totalIGSTPaise: number;
  totalGstPaise: number;
  grandTotalPaise: number;
} {
  const totals = lineItems.reduce(
    (acc, item) => {
      acc.totalTaxablePaise += item.taxableValuePaise;
      if (isIntraState) {
        acc.totalCGSTPaise += item.cgstPaise;
        acc.totalSGSTPaise += item.sgstPaise;
      } else {
        acc.totalIGSTPaise += item.igstPaise || item.cgstPaise + item.sgstPaise;
      }
      acc.totalGstPaise += item.totalGstPaise;
      acc.grandTotalPaise += item.lineTotalPaise;
      return acc;
    },
    {
      totalTaxablePaise: 0,
      totalCGSTPaise: 0,
      totalSGSTPaise: 0,
      totalIGSTPaise: 0,
      totalGstPaise: 0,
      grandTotalPaise: 0,
    }
  );

  return totals;
}

/**
 * Format paise to rupees string
 */
export function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

/**
 * Format GST rate for display
 */
export function formatGstRate(gstRate: number): string {
  return `${gstRate}%`;
}


