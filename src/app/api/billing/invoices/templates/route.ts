// Invoice Templates API
// GET /api/billing/invoices/templates - List templates
// POST /api/billing/invoices/templates - Create template

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { createInvoiceTemplate } from "@/lib/billing/invoice-management";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";

    const templates = await prisma.invoiceTemplate.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        isDefault: t.isDefault,
        createdAt: t.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Get invoice templates API error:", error);
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

    const template = await createInvoiceTemplate(tenantId, body);

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        isDefault: template.isDefault,
      },
    });
  } catch (error: any) {
    console.error("Create invoice template API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
