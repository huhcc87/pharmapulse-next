// TCS (Tax Collected at Source) Implementation
// 0.1% TCS on B2C sales above threshold

export interface TCSCalculation {
  invoiceId: number;
  invoiceAmount: number; // in paise
  tcsAmount: number; // in paise
  tcsRate: number; // 0.1%
  isB2C: boolean;
  threshold: number; // in paise (e.g., 2,00,000 = 20,000,000 paise)
}

/**
 * Calculate TCS for an invoice
 */
export function calculateTCS(
  invoiceAmount: number, // in paise
  isB2C: boolean,
  threshold: number = 20_000_000 // ₹2,00,000 in paise
): TCSCalculation | null {
  // TCS only applies to B2C transactions above threshold
  if (!isB2C || invoiceAmount < threshold) {
    return null;
  }

  const tcsRate = 0.1; // 0.1%
  const tcsAmount = Math.round((invoiceAmount * tcsRate) / 100);

  return {
    invoiceId: 0, // Will be set when saving
    invoiceAmount,
    tcsAmount,
    tcsRate,
    isB2C: true,
    threshold,
  };
}

/**
 * Generate TCS certificate
 */
export function generateTCSCertificate(
  tcsData: Array<{
    invoiceNumber: string;
    invoiceDate: Date;
    amount: number;
    tcsAmount: number;
  }>,
  period: { from: Date; to: Date }
): {
  period: { from: Date; to: Date };
  totalTCS: number;
  invoices: typeof tcsData;
  certificateNumber: string;
} {
  const totalTCS = tcsData.reduce((sum, inv) => sum + inv.tcsAmount, 0);
  const certificateNumber = `TCS/${period.from.getFullYear()}-${String(period.from.getMonth() + 1).padStart(2, '0')}/${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

  return {
    period,
    totalTCS,
    invoices: tcsData,
    certificateNumber,
  };
}
