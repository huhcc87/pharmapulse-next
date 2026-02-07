// Customer Analytics Report
// GET /api/reports/customer-analytics?from=YYYY-MM-DD&to=YYYY-MM-DD

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";

const DEMO_TENANT_ID = 1;

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const fromStr = searchParams.get("from") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const toStr = searchParams.get("to") || new Date().toISOString().split("T")[0];

    const fromDate = new Date(fromStr);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(toStr);
    toDate.setHours(23, 59, 59, 999);

    // Get invoices in date range
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: DEMO_TENANT_ID,
        invoiceDate: {
          gte: fromDate,
          lte: toDate,
        },
        status: {
          in: ["ISSUED", "FILED"],
        },
      },
      include: {
        customer: true,
      },
    });

    // Customer metrics
    const customerMap: Record<number, {
      id: number;
      name: string;
      invoiceCount: number;
      totalAmountPaise: number;
      lastPurchaseDate: Date;
    }> = {};

    invoices.forEach((inv) => {
      if (inv.customerId) {
        const customerId = inv.customerId;
        if (!customerMap[customerId]) {
          customerMap[customerId] = {
            id: customerId,
            name: inv.customer?.name || "Unknown",
            invoiceCount: 0,
            totalAmountPaise: 0,
            lastPurchaseDate: inv.invoiceDate,
          };
        }
        customerMap[customerId].invoiceCount += 1;
        customerMap[customerId].totalAmountPaise += inv.totalInvoicePaise;
        if (inv.invoiceDate > customerMap[customerId].lastPurchaseDate) {
          customerMap[customerId].lastPurchaseDate = inv.invoiceDate;
        }
      }
    });

    const customers = Object.values(customerMap);

    // Top customers by revenue
    const topCustomersByRevenue = customers
      .sort((a, b) => b.totalAmountPaise - a.totalAmountPaise)
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        name: c.name,
        invoiceCount: c.invoiceCount,
        totalAmount: c.totalAmountPaise / 100,
        averageOrderValue: c.invoiceCount > 0 ? (c.totalAmountPaise / 100) / c.invoiceCount : 0,
        lastPurchaseDate: c.lastPurchaseDate.toISOString(),
      }));

    // New vs returning customers
    const newCustomers = customers.filter((c) => c.invoiceCount === 1).length;
    const returningCustomers = customers.filter((c) => c.invoiceCount > 1).length;

    // Customer lifetime value (total spend)
    const totalCustomerRevenuePaise = customers.reduce((sum, c) => sum + c.totalAmountPaise, 0);
    const averageCustomerValue = customers.length > 0 ? totalCustomerRevenuePaise / customers.length / 100 : 0;

    // Repeat purchase rate
    const repeatPurchaseRate = customers.length > 0
      ? (returningCustomers / customers.length) * 100
      : 0;

    return NextResponse.json({
      period: {
        from: fromStr,
        to: toStr,
      },
      summary: {
        totalCustomers: customers.length,
        newCustomers,
        returningCustomers,
        averageCustomerValue,
        repeatPurchaseRate: parseFloat(repeatPurchaseRate.toFixed(2)),
      },
      topCustomers: topCustomersByRevenue,
    });
  } catch (error: any) {
    console.error("Customer analytics report error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
