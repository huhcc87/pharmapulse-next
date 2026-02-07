// Recurring Invoices API
// GET /api/billing/invoices/recurring - List recurring invoices
// POST /api/billing/invoices/recurring - Create recurring invoice

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { createRecurringInvoice, processRecurringInvoices } from "@/lib/billing/invoice-management";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");

    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }

    const recurring = await prisma.recurringInvoice.findMany({
      where,
      orderBy: {
        nextRunDate: "asc",
      },
    });

    return NextResponse.json({
      recurringInvoices: recurring.map((r) => ({
        id: r.id,
        name: r.name,
        frequency: r.frequency,
        nextRunDate: r.nextRunDate,
        status: r.status,
        invoicesGenerated: r.invoicesGenerated,
      })),
    });
  } catch (error: any) {
    console.error("Get recurring invoices API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const tenantId = user.tenantId || "default";

    const recurring = await createRecurringInvoice(tenantId, {
      ...body,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    });

    return NextResponse.json({
      success: true,
      recurringInvoice: {
        id: recurring.id,
        name: recurring.name,
        nextRunDate: recurring.nextRunDate,
        status: recurring.status,
      },
    });
  } catch (error: any) {
    console.error("Create recurring invoice API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/billing/invoices/recurring/process - Process recurring invoices (cron)
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";

    const processed = await processRecurringInvoices(tenantId);

    return NextResponse.json({
      success: true,
      processed,
    });
  } catch (error: any) {
    console.error("Process recurring invoices API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
