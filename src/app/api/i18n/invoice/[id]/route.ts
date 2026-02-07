// Get Invoice in Selected Language
// GET /api/i18n/invoice/[id]?lang=hi

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatInvoiceInLanguage, SupportedLanguage } from "@/lib/i18n/i18n";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const resolvedParams = await params;
    const invoiceId = parseInt(resolvedParams.id);
    const searchParams = req.nextUrl.searchParams;
    const lang = (searchParams.get("lang") || "en") as SupportedLanguage;

    // Fetch invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        lineItems: true,
        customer: true,
        sellerOrg: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Format invoice in selected language
    const formattedInvoice = await formatInvoiceInLanguage(invoice, lang);

    return NextResponse.json({
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        formattedText: formattedInvoice,
        language: lang,
      },
    });
  } catch (error: any) {
    console.error("Invoice i18n API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
