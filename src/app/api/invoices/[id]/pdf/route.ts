import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { formatGstState } from "@/lib/gstStateCodes";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const invoiceId = parseInt(params.id);
    
    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }

    console.log("Generating PDF for invoice:", invoiceId);

    // Fetch invoice with all related data
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lineItems: true,
        taxLines: true,
        sellerGstin: {
          include: {
            org: true,
          },
        },
      },
    }) as any;

    if (!invoice) {
      console.error("Invoice not found:", invoiceId);
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    console.log("Invoice found, generating PDF...");

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595, 842]); // A4 size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = 800; // Start from top

    // GST-compliant invoice header
    const addGstHeader = () => {
      page.drawText("TAX INVOICE", { x: 250, y: y, size: 16, font: boldFont });
      y -= 30;
      
      if (invoice.sellerGstin) {
        page.drawText(`GSTIN: ${invoice.sellerGstin.gstin}`, { x: 50, y: y, size: 10, font: font });
        y -= 15;
      }
      
      if (invoice.invoiceNumber) {
        page.drawText(`Invoice No: ${invoice.invoiceNumber}`, { x: 50, y: y, size: 10, font: font });
        y -= 15;
      }
      
      page.drawText(`Date: ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}`, { x: 50, y: y, size: 10, font: font });
      y -= 20;
    };

    // Helper to add text
    const addText = (
      text: string,
      x: number,
      yPos: number,
      size: number = 10,
      isBold: boolean = false
    ) => {
      page.drawText(text, {
        x,
        y: yPos,
        size,
        font: isBold ? boldFont : font,
        color: rgb(0, 0, 0),
      });
    };

    // Header
    addText("TAX INVOICE", 50, y, 20, true);
    y -= 30;

    if (invoice.invoiceNumber) {
      addText(`Invoice No: ${invoice.invoiceNumber}`, 50, y, 12, true);
    } else {
      addText(`Draft Invoice #${invoice.id}`, 50, y, 12, true);
    }
    y -= 15;

    addText(
      `Date: ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}`,
      50,
      y,
      10
    );
    y -= 30;

    // Seller details
    addText("Sold By:", 50, y, 12, true);
    y -= 15;
    if (invoice.sellerGstin?.org) {
      addText(invoice.sellerGstin.org.name, 50, y, 10);
      y -= 15;
    }
    if (invoice.sellerGstin?.gstin) {
      addText(`GSTIN: ${invoice.sellerGstin.gstin}`, 50, y, 10);
      y -= 15;
    }
    y -= 20;

    // Buyer details
    if (invoice.buyerName || invoice.buyerGstin) {
      addText("Buyer:", 50, y, 12, true);
      y -= 15;
      if (invoice.buyerName) {
        addText(invoice.buyerName, 50, y, 10);
        y -= 15;
      }
      if (invoice.buyerGstin) {
        addText(`GSTIN: ${invoice.buyerGstin}`, 50, y, 10);
        y -= 15;
      }
      y -= 20;
    }

    // Place of Supply
    if (invoice.placeOfSupply) {
      const placeOfSupplyText = formatGstState(invoice.placeOfSupply);
      addText(`Place of Supply: ${placeOfSupplyText}`, 50, y, 10);
      y -= 20;
    }

    // Line items table header (GST-compliant)
    y -= 10;
    addText("Item", 50, y, 9, true);
    addText("HSN", 180, y, 9, true);
    addText("Qty", 230, y, 9, true);
    addText("Rate", 270, y, 9, true);
    addText("Taxable", 320, y, 9, true);
    addText("CGST", 380, y, 9, true);
    addText("SGST", 430, y, 9, true);
    addText("Total", 480, y, 9, true);
    y -= 15;
    
    // Draw line
    page.drawLine({
      start: { x: 50, y },
      end: { x: 545, y },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    y -= 10;

    // Line items with GST breakdown
    for (const item of (invoice as any).lineItems || []) {
      const unitPrice = (item.unitPricePaise / 100).toFixed(2);
      const taxable = (item.taxablePaise / 100).toFixed(2);
      const cgst = (item.cgstPaise / 100).toFixed(2);
      const sgst = (item.sgstPaise / 100).toFixed(2);
      const lineTotal = ((item.taxablePaise + item.cgstPaise + item.sgstPaise) / 100).toFixed(2);
      const gstRate = (item.gstRateBps / 100).toFixed(1);

      addText(item.productName.substring(0, 20), 50, y, 8);
      addText(item.hsnCode || "-", 180, y, 8);
      addText(item.quantity.toString(), 230, y, 8);
      addText(unitPrice, 270, y, 8);
      addText(taxable, 320, y, 8);
      addText(cgst, 380, y, 8);
      addText(sgst, 430, y, 8);
      addText(lineTotal, 480, y, 8);
      y -= 15;

      if (y < 150) {
        // Add new page if needed
        const newPage = pdfDoc.addPage([595, 842]);
        // Update page reference for subsequent operations
        page = newPage;
        y = 800;
      }
    }

    y -= 10;
    // Draw line
    page.drawLine({
      start: { x: 50, y },
      end: { x: 545, y },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    y -= 15;

    // Totals (GST-compliant breakdown)
    const taxable = ((invoice.totalTaxablePaise || 0) / 100).toFixed(2);
    const totalCGST = ((invoice as any).totalCGSTPaise || 0) / 100;
    const totalSGST = ((invoice as any).totalSGSTPaise || 0) / 100;
    const totalGST = ((invoice.totalGstPaise || 0) / 100).toFixed(2);
    const total = ((invoice.totalInvoicePaise || 0) / 100).toFixed(2);

    addText("Subtotal (Taxable):", 300, y, 10);
    addText(`Rs.${taxable}`, 480, y, 10);
    y -= 15;

    if (totalCGST > 0) {
      addText("CGST:", 300, y, 10);
      addText(`Rs.${totalCGST.toFixed(2)}`, 480, y, 10);
      y -= 15;
    }

    if (totalSGST > 0) {
      addText("SGST:", 300, y, 10);
      addText(`Rs.${totalSGST.toFixed(2)}`, 480, y, 10);
      y -= 15;
    }

    addText("Total GST:", 300, y, 10);
    addText(`Rs.${totalGST}`, 480, y, 10);
    y -= 15;

    addText("Grand Total:", 300, y, 12, true);
    addText(`Rs.${total}`, 480, y, 12, true);
    y -= 30;

    // Payment method
    if (invoice.paymentMethod) {
      addText(`Payment Method: ${invoice.paymentMethod}`, 50, y, 10);
      y -= 15;
    }

    // QR code placeholder note
    addText("Scan QR code for payment details", 50, y, 8);

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    console.log("PDF generated successfully, size:", pdfBytes.length);

    // Return PDF with proper headers
    return new NextResponse(pdfBytes as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="INV-${invoice.invoiceNumber || invoice.id}.pdf"`,
        "Content-Length": pdfBytes.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
