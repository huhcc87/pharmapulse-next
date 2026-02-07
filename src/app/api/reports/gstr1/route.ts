import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";

const DEMO_TENANT_ID = 1;

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!from || !to) {
      return NextResponse.json({ error: "from and to dates required (YYYY-MM-DD)" }, { status: 400 });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    // Get all issued invoices in date range
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: DEMO_TENANT_ID,
        status: "ISSUED",
        invoiceDate: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        lineItems: true,
        customer: true,
        sellerGstin: true,
      },
      orderBy: {
        invoiceDate: "asc",
      },
    });

    // Get all credit notes in date range
    const creditNotes = await prisma.creditNote.findMany({
      where: {
        tenantId: DEMO_TENANT_ID,
        creditNoteDate: {
          gte: fromDate,
          lte: toDate,
        },
      },
      include: {
        lineItems: true,
        invoice: {
          include: {
            customer: true,
            sellerGstin: true,
          },
        },
      },
      orderBy: {
        creditNoteDate: "asc",
      },
    });

    // Build GSTR-1 B2B data (invoices with GSTIN)
    const b2bData = invoices
      .filter((inv) => inv.customer?.gstin)
      .flatMap((invoice) =>
        invoice.lineItems.map((line) => ({
          Table: "B2B",
          Invoice_Number: invoice.invoiceNumber || `INV-${invoice.id}`,
          Invoice_Date: invoice.invoiceDate.toISOString().split("T")[0],
          Customer_GSTIN: invoice.customer?.gstin || "",
          Customer_Name: invoice.customer?.name || invoice.buyerName || "",
          Place_of_Supply: invoice.placeOfSupplyStateCode || invoice.sellerGstin.stateCode,
          HSN: line.hsnCode || "",
          Taxable_Value: (line.taxablePaise / 100).toFixed(2),
          CGST_Rate: line.gstRateBps ? (line.gstRateBps / 100).toFixed(2) : "0.00",
          CGST_Amount: (line.cgstPaise / 100).toFixed(2),
          SGST_Rate: line.gstRateBps ? (line.gstRateBps / 100).toFixed(2) : "0.00",
          SGST_Amount: (line.sgstPaise / 100).toFixed(2),
          IGST_Rate: (invoice.supplyType || "INTRA_STATE") === "INTER_STATE" && line.gstRateBps ? (line.gstRateBps / 100).toFixed(2) : "0.00",
          IGST_Amount: (line.igstPaise / 100).toFixed(2),
          Total_Amount: (line.lineTotalPaise / 100).toFixed(2),
        }))
      );

    // Build GSTR-1 B2C Large data (invoices without GSTIN, >= ₹2.5L)
    const b2cLargeData = invoices
      .filter((inv) => !inv.customer?.gstin && inv.totalInvoicePaise >= 25000000) // ₹2.5L in paise
      .flatMap((invoice) => ({
        Table: "B2C_Large",
        Invoice_Number: invoice.invoiceNumber || `INV-${invoice.id}`,
        Invoice_Date: invoice.invoiceDate.toISOString().split("T")[0],
        Customer_Name: invoice.customer?.name || invoice.buyerName || "Walk-in Customer",
        Place_of_Supply: invoice.placeOfSupplyStateCode || invoice.sellerGstin.stateCode,
        Taxable_Value: (invoice.totalTaxablePaise / 100).toFixed(2),
        CGST_Amount: (invoice.totalCGSTPaise / 100).toFixed(2),
        SGST_Amount: (invoice.totalSGSTPaise / 100).toFixed(2),
        IGST_Amount: (invoice.totalIGSTPaise / 100).toFixed(2),
        Total_Amount: (invoice.totalInvoicePaise / 100).toFixed(2),
      }));

    // Build GSTR-1 B2C Small data (invoices without GSTIN, < ₹2.5L) - Summary by rate
    const b2cSmallByRate: Record<string, { taxable: number; cgst: number; sgst: number; igst: number }> = {};
    invoices
      .filter((inv) => !inv.customer?.gstin && inv.totalInvoicePaise < 25000000)
      .forEach((invoice) => {
        invoice.lineItems.forEach((line) => {
          const rate = line.gstRateBps ? (line.gstRateBps / 100).toFixed(2) : "0.00";
          if (!b2cSmallByRate[rate]) {
            b2cSmallByRate[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
          }
          b2cSmallByRate[rate].taxable += line.taxablePaise;
          b2cSmallByRate[rate].cgst += line.cgstPaise;
          b2cSmallByRate[rate].sgst += line.sgstPaise;
          b2cSmallByRate[rate].igst += line.igstPaise;
        });
      });

    const b2cSmallData = Object.entries(b2cSmallByRate).map(([rate, totals]) => ({
      Table: "B2C_Small",
      GST_Rate: rate,
      Taxable_Value: (totals.taxable / 100).toFixed(2),
      CGST_Amount: (totals.cgst / 100).toFixed(2),
      SGST_Amount: (totals.sgst / 100).toFixed(2),
      IGST_Amount: (totals.igst / 100).toFixed(2),
    }));

    // Build GSTR-1 HSN Summary
    const hsnSummary: Record<string, { taxable: number; cgst: number; sgst: number; igst: number; quantity: number }> = {};
    invoices.forEach((invoice) => {
      invoice.lineItems.forEach((line) => {
        const hsn = line.hsnCode || "N/A";
        if (!hsnSummary[hsn]) {
          hsnSummary[hsn] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, quantity: 0 };
        }
        hsnSummary[hsn].taxable += line.taxablePaise;
        hsnSummary[hsn].cgst += line.cgstPaise;
        hsnSummary[hsn].sgst += line.sgstPaise;
        hsnSummary[hsn].igst += line.igstPaise;
        hsnSummary[hsn].quantity += line.quantity;
      });
    });

    const hsnSummaryData = Object.entries(hsnSummary).map(([hsn, totals]) => ({
      Table: "HSN_Summary",
      HSN: hsn,
      Description: "", // Can be populated from HSN master if available
      UOM: "PCS", // Unit of measure
      Quantity: totals.quantity.toString(),
      Taxable_Value: (totals.taxable / 100).toFixed(2),
      CGST_Amount: (totals.cgst / 100).toFixed(2),
      SGST_Amount: (totals.sgst / 100).toFixed(2),
      IGST_Amount: (totals.igst / 100).toFixed(2),
    }));

    // Build GSTR-1 Credit Note data
    const creditNoteData = creditNotes.flatMap((cn) => {
      // Calculate GST rate from CGST/SGST amounts if not available
      const getGstRate = (line: any) => {
        if (line.taxablePaise > 0) {
          const totalGst = line.cgstPaise + line.sgstPaise + line.igstPaise;
          return totalGst > 0 ? ((totalGst / line.taxablePaise) * 100).toFixed(2) : "0.00";
        }
        return "0.00";
      };

      return cn.lineItems.map((line) => {
        const gstRate = getGstRate(line);
        return {
          Table: "Credit_Note",
          Credit_Note_Number: cn.creditNoteNumber,
          Credit_Note_Date: cn.creditNoteDate.toISOString().split("T")[0],
          Original_Invoice_Number: cn.invoice.invoiceNumber || "",
          Original_Invoice_Date: cn.invoice.invoiceDate.toISOString().split("T")[0],
          Customer_GSTIN: cn.invoice.customer?.gstin || "",
          Place_of_Supply: cn.invoice.placeOfSupplyStateCode || cn.invoice.sellerGstin.stateCode,
          HSN: line.hsnCode || "",
          Taxable_Value: (line.taxablePaise / 100).toFixed(2),
          CGST_Rate: gstRate,
          CGST_Amount: (line.cgstPaise / 100).toFixed(2),
          SGST_Rate: gstRate,
          SGST_Amount: (line.sgstPaise / 100).toFixed(2),
          IGST_Rate: (cn.invoice.supplyType || "INTRA_STATE") === "INTER_STATE" ? gstRate : "0.00",
          IGST_Amount: (line.igstPaise / 100).toFixed(2),
          Total_Amount: (line.lineTotalPaise / 100).toFixed(2),
        };
      });
    });

    // Combine all GSTR-1 data
    const gstr1Data = [
      ...b2bData,
      ...b2cLargeData,
      ...b2cSmallData,
      ...hsnSummaryData,
      ...creditNoteData,
    ];

    // Convert to CSV
    if (gstr1Data.length === 0) {
      return NextResponse.json({ error: "No data found for the date range" }, { status: 404 });
    }

    const headers = Object.keys(gstr1Data[0]);
    const csvRows = [
      headers.join(","),
      ...gstr1Data.map((row) => headers.map((h) => `"${row[h as keyof typeof row]}"`).join(",")),
    ];

    const csv = csvRows.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="gstr1_${from}_${to}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("GSTR-1 export error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export GSTR-1" },
      { status: 500 }
    );
  }
}
