import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

// Helper to get start of today in UTC
function startOfTodayUTC(): Date {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return today;
}

// Helper to get end of today in UTC
function endOfTodayUTC(): Date {
  const start = startOfTodayUTC();
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

// Helper to get start of current month in UTC
function startOfMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function GET() {
  try {
    const todayStart = startOfTodayUTC();
    const todayEnd = endOfTodayUTC();
    const monthStart = startOfMonthUTC();
    const now = new Date();

    // KPIs: Today's Sales & Invoices
    let todaySales = 0;
    let invoicesIssuedToday = 0;
    let invoicesDraft = 0;

    try {
      const todayInvoices = await prisma.invoice.findMany({
        where: {
          tenantId: DEMO_TENANT_ID,
          invoiceDate: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
        select: {
          status: true,
          totalInvoicePaise: true,
        },
      });

      todaySales = todayInvoices
        .filter((inv) => inv.status === "ISSUED")
        .reduce((sum, inv) => sum + inv.totalInvoicePaise, 0);

      invoicesIssuedToday = todayInvoices.filter((inv) => inv.status === "ISSUED").length;
      invoicesDraft = await prisma.invoice.count({
        where: {
          tenantId: DEMO_TENANT_ID,
          status: "DRAFT",
        },
      });
    } catch (e) {
      console.warn("Error fetching invoice KPIs:", e);
    }

    // KPIs: GST MTD Liability
    let gstMtdLiability = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    try {
      const mtdInvoices = await prisma.invoice.findMany({
        where: {
          tenantId: DEMO_TENANT_ID,
          invoiceDate: { gte: monthStart },
          status: "ISSUED",
        },
        include: {
          taxLines: true,
        },
      });

      for (const inv of mtdInvoices) {
        for (const tax of inv.taxLines) {
          const taxAmount = tax.taxPaise;
          gstMtdLiability += taxAmount;
          if (tax.taxType === "CGST") cgst += taxAmount;
          else if (tax.taxType === "SGST") sgst += taxAmount;
          else if (tax.taxType === "IGST") igst += taxAmount;
        }
      }
    } catch (e) {
      console.warn("Error fetching GST KPIs:", e);
    }

    // KPIs: Inventory (Low Stock, Near Expiry, Expired)
    let lowStock = 0;
    let nearExpiry30 = 0;
    let expired = 0;
    const expiry30DaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    try {
      const inventoryItems = await prisma.inventoryItem.findMany({
        where: {
          tenantId: DEMO_TENANT_ID,
        },
        select: {
          qtyOnHand: true,
          reorderLevel: true,
          expiryDate: true,
        },
      });

      for (const item of inventoryItems) {
        // Low stock check
        if (item.reorderLevel !== null && item.qtyOnHand <= item.reorderLevel) {
          lowStock++;
        }

        // Expiry checks
        if (item.expiryDate) {
          const expiry = new Date(item.expiryDate);
          if (expiry < now) {
            expired++;
          } else if (expiry <= expiry30DaysFromNow) {
            nearExpiry30++;
          }
        }
      }
    } catch (e) {
      console.warn("Error fetching inventory KPIs:", e);
    }

    // KPIs: POS & Barcode Health
    let scanSuccessToday = 0;
    let scanFailToday = 0;
    let unmappedBarcodes = 0;

    try {
      // Count successful scans today (DrugScanEvent records)
      scanSuccessToday = await prisma.drugScanEvent.count({
        where: {
          tenantId: DEMO_TENANT_ID,
          scannedAt: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      });

      // Count products without barcode mapping
      unmappedBarcodes = await prisma.product.count({
        where: {
          barcodeValue: null,
          OR: [{ barcode: null }, { barcode: "" }],
        },
      });
    } catch (e) {
      console.warn("Error fetching POS/barcode KPIs:", e);
    }

    // Alerts
    const alerts: Array<{
      id: string;
      severity: "info" | "warn" | "critical";
      title: string;
      detail: string;
      href: string;
    }> = [];

    if (expired > 0) {
      alerts.push({
        id: "expired-items",
        severity: "critical",
        title: `${expired} expired inventory items`,
        detail: "Remove expired items from inventory immediately",
        href: "/inventory/expiry-center",
      });
    }

    if (nearExpiry30 > 0) {
      alerts.push({
        id: "near-expiry",
        severity: "warn",
        title: `${nearExpiry30} items expiring within 30 days`,
        detail: "Review and take action on items nearing expiry",
        href: "/inventory/expiry-center",
      });
    }

    if (lowStock > 0) {
      alerts.push({
        id: "low-stock",
        severity: "warn",
        title: `${lowStock} items below reorder level`,
        detail: "Consider placing purchase orders",
        href: "/inventory",
      });
    }

    if (invoicesDraft > 0) {
      alerts.push({
        id: "draft-invoices",
        severity: "info",
        title: `${invoicesDraft} draft invoices pending`,
        detail: "Review and issue draft invoices",
        href: "/invoices",
      });
    }

    // Compliance & Risk
    let missingHsnCount = 0;
    let dpcoRiskCount = 0;
    let expiredSaleFlag = false;

    try {
      // Count products missing HSN
      const productsMissingHsn = await prisma.product.count({
        where: {
          OR: [{ hsnCode: null }, { hsnCode: "" }],
        },
      });

      // DrugLibrary doesn't have hsnCode field in schema, so we only count Products
      missingHsnCount = productsMissingHsn;

      // Check for DPCO ceiling price violations (count items with DPCO price set)
      dpcoRiskCount = await prisma.drugLibrary.count({
        where: {
          dpcoCeilingPriceInr: { not: null },
        },
      });

      // Check if any invoices have expired items (simplified - would need line item expiry check)
      expiredSaleFlag = false; // TODO: Implement proper check via InvoiceLineItem.expiryDate
    } catch (e) {
      console.warn("Error fetching compliance data:", e);
    }

    // Calculate risk score (0-100, lower is better)
    let riskScore = 0;
    if (expired > 0) riskScore += 30;
    if (nearExpiry30 > 5) riskScore += 20;
    if (missingHsnCount > 10) riskScore += 25;
    if (dpcoRiskCount > 0) riskScore += 15;
    if (expiredSaleFlag) riskScore += 10;

    const gstr1Status: "ok" | "due" | "overdue" | "unknown" = "unknown";
    const gstr3bStatus: "ok" | "due" | "overdue" | "unknown" = "unknown";

    // Inventory Insights
    let topMovingSkus: Array<{ name: string; qty: number }> = [];
    let deadStockCount = 0;
    const expiryBuckets = { "0_30": 0, "30_90": 0, "90_plus": 0 };

    try {
      // Top moving SKUs (from invoice line items this month)
      const topItems = await prisma.invoiceLineItem.groupBy({
        by: ["productName"],
        where: {
          invoice: {
            tenantId: DEMO_TENANT_ID,
            invoiceDate: { gte: monthStart },
            status: "ISSUED",
          },
        },
        _sum: {
          quantity: true,
        },
        orderBy: {
          _sum: {
            quantity: "desc",
          },
        },
        take: 5,
      });

      topMovingSkus = topItems.map((item) => ({
        name: item.productName,
        qty: item._sum.quantity ?? 0,
      }));

      // Expiry buckets
      const itemsWithExpiry = await prisma.inventoryItem.findMany({
        where: {
          tenantId: DEMO_TENANT_ID,
          expiryDate: { not: null },
        },
        select: {
          expiryDate: true,
        },
      });

      const nowTime = now.getTime();
      const days30 = 30 * 24 * 60 * 60 * 1000;
      const days90 = 90 * 24 * 60 * 60 * 1000;

      for (const item of itemsWithExpiry) {
        if (!item.expiryDate) continue;
        const expiryTime = new Date(item.expiryDate).getTime();
        const daysUntilExpiry = expiryTime - nowTime;

        if (daysUntilExpiry <= days30 && daysUntilExpiry >= 0) {
          expiryBuckets["0_30"]++;
        } else if (daysUntilExpiry <= days90 && daysUntilExpiry > days30) {
          expiryBuckets["30_90"]++;
        } else if (daysUntilExpiry > days90) {
          expiryBuckets["90_plus"]++;
        }
      }

      // Dead stock (items with no sales in last 90 days - simplified)
      deadStockCount = 0; // TODO: Implement proper dead stock calculation
    } catch (e) {
      console.warn("Error fetching inventory insights:", e);
    }

    // Add scan logging alert if needed
    if (scanSuccessToday === 0 && scanFailToday === 0) {
      alerts.push({
        id: "scan-logging",
        severity: "info",
        title: "Enable scan logging",
        detail: "Scan health metrics will appear after logging is enabled",
        href: "/settings",
      });
    }

    return NextResponse.json({
      kpis: {
        todaySales,
        invoices: {
          issuedToday: invoicesIssuedToday,
          draft: invoicesDraft,
        },
        gst: {
          mtdLiability: gstMtdLiability,
          cgst,
          sgst,
          igst,
        },
        inventory: {
          lowStock,
          nearExpiry30,
          expired,
        },
        pos: {
          scanSuccessToday,
          scanFailToday,
          unmappedBarcodes,
        },
      },
      alerts,
      compliance: {
        gstr1Status,
        gstr3bStatus,
        missingHsnCount,
        dpcoRiskCount,
        expiredSaleFlag,
        riskScore,
      },
      insights: {
        topMovingSkus,
        deadStockCount,
        expiryBuckets,
      },
    });
  } catch (error: any) {
    console.error("Dashboard summary error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to fetch dashboard summary" },
      { status: 500 }
    );
  }
}

