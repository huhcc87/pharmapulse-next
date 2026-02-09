// src/lib/receipt/pdf-generator.ts
// Client-side PDF generation for offline receipts
// Uses pdf-lib (already installed) for browser-based PDF generation

import { PDFDocument, rgb, StandardFonts, PDFPage } from "pdf-lib";

export interface OfflineInvoiceData {
  invoiceNumber?: string;
  invoiceDate: Date | string;
  customerName?: string | null;
  buyerGstin?: string | null;
  sellerGstin?: string;
  placeOfSupply?: string | null;
  lineItems: Array<{
    productName: string;
    quantity: number;
    unitPricePaise: number;
    hsnCode?: string | null;
    gstRate?: number | null;
    cgstPaise?: number;
    sgstPaise?: number;
    igstPaise?: number;
    taxableValuePaise?: number;
    lineTotalPaise?: number;
  }>;
  totals: {
    totalTaxablePaise: number;
    totalCGSTPaise: number;
    totalSGSTPaise: number;
    totalIGSTPaise: number;
    grandTotalPaise: number;
    roundOffPaise?: number;
  };
  paymentMethod?: string;
  paidAmountPaise?: number;
}

/**
 * Convert Uint8Array (possibly typed as ArrayBufferLike) into a strict ArrayBuffer
 * that satisfies DOM typings for BlobPart.
 */
function uint8ToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  // If bytes.buffer is already ArrayBuffer, slice just the used region safely.
  const buf = bytes.buffer;
  if (buf instanceof ArrayBuffer) {
    return buf.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }

  // Fallback: copy into a new ArrayBuffer
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

/**
 * Generate PDF receipt for offline invoice
 */
export async function generateOfflineReceiptPDF(
  invoiceData: OfflineInvoiceData
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  let page: PDFPage = pdfDoc.addPage([595, 842]); // A4 size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;

  // Helper to add text (uses the current `page`)
  const addText = (
    text: string,
    x: number,
    yPos: number,
    size: number,
    isBold = false
  ) => {
    page.drawText(text ?? "", {
      x,
      y: yPos,
      size,
      font: isBold ? boldFont : font,
      color: rgb(0, 0, 0),
    });
  };

  const drawLine = () => {
    page.drawLine({
      start: { x: 50, y },
      end: { x: 550, y },
      thickness: 0.5,
      color: rgb(0, 0, 0),
    });
  };

  // Header
  addText("PHARMAPULSE", 50, y, 20, true);
  y -= 25;
  addText("TAX INVOICE", 50, y, 14, true);
  y -= 30;

  // Invoice details
  addText(`Invoice No: ${invoiceData.invoiceNumber || "OFFLINE"}`, 50, y, 10);
  y -= 15;

  const dateStr = new Date(invoiceData.invoiceDate).toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  addText(`Date: ${dateStr}`, 50, y, 10);
  y -= 20;

  // Seller details
  if (invoiceData.sellerGstin) {
    addText(`GSTIN: ${invoiceData.sellerGstin}`, 50, y, 9);
    y -= 15;
  }

  // Buyer details
  if (invoiceData.customerName) {
    addText(`Buyer: ${invoiceData.customerName}`, 50, y, 9);
    y -= 15;
  }
  if (invoiceData.buyerGstin) {
    addText(`Buyer GSTIN: ${invoiceData.buyerGstin}`, 50, y, 9);
    y -= 15;
  }
  if (invoiceData.placeOfSupply) {
    addText(`Place of Supply: ${invoiceData.placeOfSupply}`, 50, y, 9);
    y -= 20;
  }

  // Line items header
  y -= 10;
  addText("Item", 50, y, 9, true);
  addText("HSN", 320, y, 9, true);
  addText("Qty", 380, y, 9, true);
  addText("Rate", 420, y, 9, true);
  addText("Total", 500, y, 9, true);
  y -= 5;

  drawLine();
  y -= 10;

  const ensureSpace = (minY: number) => {
    if (y >= minY) return;
    page = pdfDoc.addPage([595, 842]);
    y = 820;

    // Re-draw header row on new page for readability
    addText("Item", 50, y, 9, true);
    addText("HSN", 320, y, 9, true);
    addText("Qty", 380, y, 9, true);
    addText("Rate", 420, y, 9, true);
    addText("Total", 500, y, 9, true);
    y -= 5;
    drawLine();
    y -= 10;
  };

  // Line items
  for (const item of invoiceData.lineItems) {
    ensureSpace(120);

    const itemName =
      item.productName.length > 30
        ? item.productName.substring(0, 27) + "..."
        : item.productName;

    const lineTotalPaise =
      item.lineTotalPaise ?? item.unitPricePaise * item.quantity;

    addText(itemName, 50, y, 9);
    addText(item.hsnCode || "-", 320, y, 9);
    addText(String(item.quantity), 380, y, 9);
    addText(`₹${(item.unitPricePaise / 100).toFixed(2)}`, 420, y, 9);
    addText(`₹${(lineTotalPaise / 100).toFixed(2)}`, 500, y, 9);

    y -= 12;
  }

  y -= 10;
  drawLine();
  y -= 15;

  ensureSpace(200);

  // Totals
  addText("Subtotal (Taxable):", 350, y, 10);
  addText(`₹${(invoiceData.totals.totalTaxablePaise / 100).toFixed(2)}`, 500, y, 10);
  y -= 15;

  const isInterState = invoiceData.totals.totalIGSTPaise > 0;
  if (isInterState) {
    addText("IGST:", 350, y, 10);
    addText(`₹${(invoiceData.totals.totalIGSTPaise / 100).toFixed(2)}`, 500, y, 10);
    y -= 15;
  } else {
    addText("CGST:", 350, y, 10);
    addText(`₹${(invoiceData.totals.totalCGSTPaise / 100).toFixed(2)}`, 500, y, 10);
    y -= 15;
    addText("SGST:", 350, y, 10);
    addText(`₹${(invoiceData.totals.totalSGSTPaise / 100).toFixed(2)}`, 500, y, 10);
    y -= 15;
  }

  if (invoiceData.totals.roundOffPaise && invoiceData.totals.roundOffPaise !== 0) {
    addText("Round Off:", 350, y, 10);
    addText(`₹${(invoiceData.totals.roundOffPaise / 100).toFixed(2)}`, 500, y, 10);
    y -= 15;
  }

  addText("Grand Total:", 350, y, 12, true);
  addText(`₹${(invoiceData.totals.grandTotalPaise / 100).toFixed(2)}`, 500, y, 12, true);
  y -= 20;

  // Payment details
  if (invoiceData.paymentMethod) {
    addText(`Payment Method: ${invoiceData.paymentMethod}`, 50, y, 10);
    y -= 15;
  }
  if (invoiceData.paidAmountPaise) {
    addText(`Paid Amount: ₹${(invoiceData.paidAmountPaise / 100).toFixed(2)}`, 50, y, 10);
    y -= 20;
  }

  // Footer
  y -= 20;
  addText("Thank you for your business!", 50, y, 10);
  y -= 15;
  addText("This is an offline receipt. Please sync when online for official copy.", 50, y, 8);

  // Generate PDF blob (TS-safe)
  const pdfBytes = await pdfDoc.save(); // Uint8Array
  const ab = uint8ToArrayBuffer(pdfBytes);
  return new Blob([ab], { type: "application/pdf" });
}

/**
 * Download PDF receipt
 */
export function downloadReceiptPDF(blob: Blob, filename: string = "invoice.pdf"): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Store PDF in IndexedDB for offline access
 */
export async function storeReceiptPDF(invoiceId: string, blob: Blob): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;

  try {
    // Use same DB as offline invoices
    const { initIndexedDB } = await import("@/lib/offline/indexeddb");
    await initIndexedDB();

    // Store PDF as base64 in localStorage (simple + reliable)
    const reader = new FileReader();
    reader.readAsDataURL(blob);

    await new Promise<void>((resolve, reject) => {
      reader.onload = () => {
        const base64Data = reader.result as string;
        const storageKey = `offline_receipt_${invoiceId}`;
        localStorage.setItem(storageKey, base64Data);
        resolve();
      };
      reader.onerror = () => reject(reader.error);
    });
  } catch (error) {
    console.error("Failed to store receipt PDF:", error);
    // Optional feature; do not throw
  }
}
