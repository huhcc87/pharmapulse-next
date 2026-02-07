import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type") || "report"; // report, year-end
    const format = searchParams.get("format") || "json"; // json, csv
    const periodStart = searchParams.get("periodStart");
    const periodEnd = searchParams.get("periodEnd");
    const year = searchParams.get("year");

    let data: any;

    if (type === "year-end") {
      const yearRes = await fetch(
        `${req.nextUrl.origin}/api/gst/year-end-summary?year=${year || new Date().getFullYear()}`
      );
      if (!yearRes.ok) {
        throw new Error("Failed to fetch year-end summary");
      }
      data = await yearRes.json();
    } else {
      if (!periodStart || !periodEnd) {
        return NextResponse.json(
          { error: "periodStart and periodEnd are required for reports" },
          { status: 400 }
        );
      }
      const reportRes = await fetch(
        `${req.nextUrl.origin}/api/gst/reports?periodStart=${periodStart}&periodEnd=${periodEnd}`
      );
      if (!reportRes.ok) {
        throw new Error("Failed to fetch report");
      }
      data = await reportRes.json();
    }

    if (format === "csv") {
      // Convert to CSV format
      const csv = convertToCSV(data, type);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="gst-${type}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // JSON format
    return NextResponse.json(data, {
      headers: {
        "Content-Disposition": `attachment; filename="gst-${type}-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error: any) {
    console.error("Error exporting GST data:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to export" },
      { status: 500 }
    );
  }
}

function convertToCSV(data: any, type: string): string {
  if (type === "year-end") {
    // Year-end CSV format
    const lines: string[] = [];
    lines.push("Year-End GST Summary");
    lines.push(`Year: ${data.year}`);
    lines.push("");
    lines.push("Annual Totals");
    lines.push("Taxable,CGST,SGST,IGST,Total GST,Total Invoice,Count");
    lines.push(
      `${data.annual.taxable},${data.annual.cgst},${data.annual.sgst},${data.annual.igst},${data.annual.gst},${data.annual.invoice},${data.annual.count}`
    );
    lines.push("");
    lines.push("B2B vs B2C");
    lines.push("Type,Taxable,GST,Invoice,Count");
    lines.push(
      `B2B,${data.b2b.taxable},${data.b2b.gst},${data.b2b.invoice},${data.b2b.count}`
    );
    lines.push(
      `B2C,${data.b2c.taxable},${data.b2c.gst},${data.b2c.invoice},${data.b2c.count}`
    );
    lines.push("");
    lines.push("Top HSN Codes");
    lines.push("HSN Code,Taxable");
    data.topHsn.forEach((item: any) => {
      lines.push(`${item.hsn},${item.taxable}`);
    });
    return lines.join("\n");
  } else {
    // Report CSV format
    const lines: string[] = [];
    lines.push("GST Report");
    lines.push(`Period: ${data.periodStart} to ${data.periodEnd}`);
    lines.push("");
    lines.push("Totals");
    lines.push("Taxable,CGST,SGST,IGST,Total GST,Total Invoice,Count");
    lines.push(
      `${data.totals.taxable},${data.totals.cgst},${data.totals.sgst},${data.totals.igst},${data.totals.gst},${data.totals.invoice},${data.totals.count}`
    );
    return lines.join("\n");
  }
}










