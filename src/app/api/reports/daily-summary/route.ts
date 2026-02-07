// Daily Sales Summary Report
// GET /api/reports/daily-summary?date=YYYY-MM-DD

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";

const DEMO_TENANT_ID = 1;

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const date = new Date(dateStr);
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // Get invoices for the day
    const invoices = await prisma.invoice.findMany({
      where: {
        tenantId: DEMO_TENANT_ID,
        invoiceDate: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ["ISSUED", "FILED"],
        },
      },
      include: {
        lineItems: true,
        payments: true,
        customer: true,
      },
    });

    // Calculate summaries
    const totalInvoices = invoices.length;
    const totalAmountPaise = invoices.reduce((sum, inv) => sum + inv.totalInvoicePaise, 0);
    const totalAmount = totalAmountPaise / 100;

    // Payment method breakdown
    const paymentMethods = {
      CASH: 0,
      CARD: 0,
      UPI: 0,
      WALLET: 0,
      CHEQUE: 0,
      BANK_TRANSFER: 0,
      CREDIT: 0,
      SPLIT: 0,
    };

    invoices.forEach((inv) => {
      inv.payments.forEach((payment) => {
        const method = payment.method || "CASH";
        paymentMethods[method as keyof typeof paymentMethods] =
          (paymentMethods[method as keyof typeof paymentMethods] || 0) + payment.amountPaise;
      });
    });

    // Convert to rupees
    const paymentBreakdown = Object.entries(paymentMethods).map(([method, amountPaise]) => ({
      method,
      amount: amountPaise / 100,
      count: invoices.filter((inv) =>
        inv.payments.some((p) => p.method === method)
      ).length,
    }));

    // Customer breakdown
    const b2bInvoices = invoices.filter((inv) => inv.invoiceType === "B2B");
    const b2cInvoices = invoices.filter((inv) => inv.invoiceType === "B2C");

    // GST summary
    const totalCGSTPaise = invoices.reduce((sum, inv) => sum + inv.totalCGSTPaise, 0);
    const totalSGSTPaise = invoices.reduce((sum, inv) => sum + inv.totalSGSTPaise, 0);
    const totalIGSTPaise = invoices.reduce((sum, inv) => sum + inv.totalIGSTPaise, 0);
    const totalGSTPaise = invoices.reduce((sum, inv) => sum + inv.totalGstPaise, 0);

    // Top selling products
    const productSales: Record<string, { name: string; quantity: number; revenuePaise: number }> = {};
    invoices.forEach((inv) => {
      inv.lineItems.forEach((item) => {
        const key = item.productId || item.drugLibraryId || item.productName;
        if (!productSales[key]) {
          productSales[key] = {
            name: item.productName,
            quantity: 0,
            revenuePaise: 0,
          };
        }
        productSales[key].quantity += item.quantity;
        productSales[key].revenuePaise += item.lineTotalPaise;
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenuePaise - a.revenuePaise)
      .slice(0, 10)
      .map((p) => ({
        name: p.name,
        quantity: p.quantity,
        revenue: p.revenuePaise / 100,
      }));

    // Hourly sales breakdown
    const hourlySales: Record<number, number> = {};
    invoices.forEach((inv) => {
      const hour = new Date(inv.invoiceDate).getHours();
      hourlySales[hour] = (hourlySales[hour] || 0) + inv.totalInvoicePaise;
    });

    const hourlyBreakdown = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      amount: (hourlySales[hour] || 0) / 100,
      count: invoices.filter(
        (inv) => new Date(inv.invoiceDate).getHours() === hour
      ).length,
    }));

    return NextResponse.json({
      date: dateStr,
      summary: {
        totalInvoices,
        totalAmount,
        averageOrderValue: totalInvoices > 0 ? totalAmount / totalInvoices : 0,
        b2bInvoices: b2bInvoices.length,
        b2cInvoices: b2cInvoices.length,
      },
      payments: {
        total: totalAmount,
        breakdown: paymentBreakdown,
      },
      gst: {
        cgst: totalCGSTPaise / 100,
        sgst: totalSGSTPaise / 100,
        igst: totalIGSTPaise / 100,
        total: totalGSTPaise / 100,
      },
      topProducts,
      hourlyBreakdown,
    });
  } catch (error: any) {
    console.error("Daily summary report error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
