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
      return NextResponse.json(
        { error: "from and to dates required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    // Get all invoice line items in date range
    const lineItems = await prisma.invoiceLineItem.findMany({
      where: {
        invoice: {
          tenantId: DEMO_TENANT_ID,
          status: "ISSUED",
          invoiceDate: {
            gte: fromDate,
            lte: toDate,
          },
        },
        hsnCode: { not: null },
      },
      select: {
        hsnCode: true,
        taxablePaise: true,
        cgstPaise: true,
        sgstPaise: true,
        igstPaise: true,
        gstRate: true,
      },
    });

    // Aggregate by HSN code
    const hsnMap = new Map<
      string,
      {
        hsnCode: string;
        totalTaxablePaise: number;
        totalCGSTPaise: number;
        totalSGSTPaise: number;
        totalIGSTPaise: number;
        totalGSTPaise: number;
        invoiceCount: number;
        lineItemCount: number;
        gstRate: number;
      }
    >();

    for (const item of lineItems) {
      if (!item.hsnCode) continue;

      const existing = hsnMap.get(item.hsnCode) || {
        hsnCode: item.hsnCode,
        totalTaxablePaise: 0,
        totalCGSTPaise: 0,
        totalSGSTPaise: 0,
        totalIGSTPaise: 0,
        totalGSTPaise: 0,
        invoiceCount: 0,
        lineItemCount: 0,
        gstRate: item.gstRate ? Number(item.gstRate) : 0,
      };

      existing.totalTaxablePaise += item.taxablePaise;
      existing.totalCGSTPaise += item.cgstPaise;
      existing.totalSGSTPaise += item.sgstPaise;
      existing.totalIGSTPaise += item.igstPaise;
      existing.totalGSTPaise +=
        item.cgstPaise + item.sgstPaise + item.igstPaise;
      existing.lineItemCount += 1;

      hsnMap.set(item.hsnCode, existing);
    }

    // Get unique invoice count per HSN
    const invoicesByHsn = await prisma.invoice.findMany({
      where: {
        tenantId: DEMO_TENANT_ID,
        status: "ISSUED",
        invoiceDate: {
          gte: fromDate,
          lte: toDate,
        },
        lineItems: {
          some: {
            hsnCode: { not: null },
          },
        },
      },
      include: {
        lineItems: {
          where: {
            hsnCode: { not: null },
          },
          select: {
            hsnCode: true,
          },
        },
      },
    });

    for (const invoice of invoicesByHsn) {
      const hsnCodes = new Set(
        invoice.lineItems.map((item) => item.hsnCode!).filter(Boolean)
      );
      for (const hsnCode of Array.from(hsnCodes)) {
        const existing = hsnMap.get(hsnCode);
        if (existing) {
          existing.invoiceCount += 1;
        }
      }
    }

    const summary = Array.from(hsnMap.values()).sort((a, b) =>
      a.hsnCode.localeCompare(b.hsnCode)
    );

    return NextResponse.json({
      from,
      to,
      summary,
      totalHsnCodes: summary.length,
      totalTaxablePaise: summary.reduce((sum, s) => sum + s.totalTaxablePaise, 0),
      totalGSTPaise: summary.reduce((sum, s) => sum + s.totalGSTPaise, 0),
    });
  } catch (error: any) {
    console.error("HSN summary error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate HSN summary" },
      { status: 500 }
    );
  }
}
