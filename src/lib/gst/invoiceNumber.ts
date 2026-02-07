// src/lib/gst/invoiceNumber.ts
// Generate GST-compliant invoice numbers (FY-based: PP/24-25/0001)

/**
 * Get current financial year in India (April to March)
 * Returns format: "24-25" for FY 2024-25
 */
export function getCurrentFinancialYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  // Financial year starts in April (month 4)
  if (month >= 4) {
    // April to December: same year
    const fyStart = year.toString().slice(-2);
    const fyEnd = (year + 1).toString().slice(-2);
    return `${fyStart}-${fyEnd}`;
  } else {
    // January to March: previous year
    const fyStart = (year - 1).toString().slice(-2);
    const fyEnd = year.toString().slice(-2);
    return `${fyStart}-${fyEnd}`;
  }
}

/**
 * Allocate invoice number using OrgGstin's nextInvoiceNo
 * Format: PREFIX/FY/SEQUENCE (e.g., PP/24-25/0001)
 */
export async function allocateInvoiceNumber(
  sellerGstinId: number,
  prisma: any
): Promise<string> {
  const sellerGstin = await prisma.orgGstin.findUnique({
    where: { id: sellerGstinId },
  });

  if (!sellerGstin) {
    throw new Error("Seller GSTIN not found");
  }

  const prefix = sellerGstin.invoicePrefix || "PP";
  const fy = getCurrentFinancialYear();
  const sequence = sellerGstin.nextInvoiceNo || 1;

  // Update next invoice number
  await prisma.orgGstin.update({
    where: { id: sellerGstinId },
    data: { nextInvoiceNo: sequence + 1 },
  });

  const paddedSequence = sequence.toString().padStart(4, "0");
  return `${prefix}/${fy}/${paddedSequence}`;
}

/**
 * Generate invoice number in format: PREFIX/FY/SEQUENCE
 * Example: PP/24-25/0001
 */
export async function generateInvoiceNumber(
  prefix: string = "PP",
  getNextSequence: () => Promise<number>
): Promise<string> {
  const fy = getCurrentFinancialYear();
  const sequence = await getNextSequence();
  const paddedSequence = sequence.toString().padStart(4, "0");
  return `${prefix}/${fy}/${paddedSequence}`;
}

/**
 * Parse invoice number to extract components
 */
export function parseInvoiceNumber(invoiceNumber: string): {
  prefix: string;
  financialYear: string;
  sequence: number;
} | null {
  const match = invoiceNumber.match(/^([A-Z]+)\/(\d{2}-\d{2})\/(\d+)$/);
  if (!match) return null;

  return {
    prefix: match[1],
    financialYear: match[2],
    sequence: parseInt(match[3], 10),
  };
}
