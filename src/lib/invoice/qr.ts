// Invoice QR code generation

export interface InvoiceQrPayload {
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  gstin?: string;
  upiVpa?: string;
}

/**
 * Generate UPI QR payload
 */
export function generateUpiQrPayload(
  upiVpa: string,
  amount: number,
  invoiceNumber: string
): string {
  // Format: upi://pay?pa=<vpa>&am=<amount>&cu=INR&tn=<description>
  const params = new URLSearchParams({
    pa: upiVpa,
    am: (amount / 100).toFixed(2),
    cu: "INR",
    tn: `Invoice ${invoiceNumber}`,
  });

  return `upi://pay?${params.toString()}`;
}

/**
 * Generate invoice verification QR payload (plain text)
 */
export function generateInvoiceVerificationQr(invoice: InvoiceQrPayload): string {
  return JSON.stringify({
    type: "INVOICE",
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.invoiceDate,
    amount: invoice.totalAmount,
    gstin: invoice.gstin,
  });
}
