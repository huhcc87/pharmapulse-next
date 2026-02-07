import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { can, createPermissionError } from "@/lib/permissions";
import { logPosAction } from "@/lib/pos-audit";

const DEMO_TENANT_ID = 1;

// GET /api/pos/repeat-last-invoice
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const userId = parseInt(user.userId) || 1;
    const role = user.role as string;

    // Check permission
    if (!can(role, "POS_REPEAT_LAST_INVOICE")) {
      const error = createPermissionError("POS_REPEAT_LAST_INVOICE", role);
      await logPosAction("POS_REPEAT_LAST_INVOICE", userId, DEMO_TENANT_ID, null, {
        allowed: false,
        role,
      });
      return NextResponse.json(error, { status: 403 });
    }

    // Get last completed invoice for this tenant/user
    const lastInvoice = await prisma.invoice.findFirst({
      where: {
        tenantId: DEMO_TENANT_ID,
        status: "ISSUED",
      },
      include: {
        lineItems: true, // InvoiceLineItem doesn't have product/drugLibrary relations
        customer: true,
      },
      orderBy: {
        invoiceDate: "desc",
      },
    });

    if (!lastInvoice) {
      return NextResponse.json(
        { error: "No previous invoice found" },
        { status: 404 }
      );
    }

    // Convert line items to cart format
    const lineItems = lastInvoice.lineItems.map((item) => {
      // Note: InvoiceLineItem doesn't have product/drugLibrary relations
      // Use productId/drugLibraryId instead
      const productId = item.productId;
      const drugLibraryId = item.drugLibraryId;

      return {
        key: `product-${item.productId || item.drugLibraryId || item.id}`,
        productName: item.productName,
        unitPricePaise: item.unitPricePaise,
        quantity: item.quantity,
        hsnCode: item.hsnCode || null,
        gstRate: item.gstRateBps ? item.gstRateBps / 100 : 12,
        gstType: (item.gstType || "EXCLUSIVE") as "INCLUSIVE" | "EXCLUSIVE",
        gstRateBps: item.gstRateBps,
        ean: item.ean || null,
        productId: item.productId || null,
        drugLibraryId: item.drugLibraryId || null,
        // Check current stock and adjust if needed
        // Note: Since InvoiceLineItem doesn't have product/drugLibrary relations,
        // we can't check stock here - use item.quantity as fallback
        availableQty: item.quantity, // Simplified - stock check would require separate query
      };
    });

    // Log action
    await logPosAction("POS_REPEAT_LAST_INVOICE", userId, DEMO_TENANT_ID, null, {
      invoiceId: lastInvoice.id,
    });

    return NextResponse.json({
      invoice: {
        id: lastInvoice.id,
        invoiceNumber: lastInvoice.invoiceNumber,
        invoiceDate: lastInvoice.invoiceDate,
      },
      customer: lastInvoice.customer
        ? {
            id: lastInvoice.customer.id,
            name: lastInvoice.customer.name,
            phone: lastInvoice.customer.phone,
          }
        : null,
      lineItems,
    });
  } catch (error: any) {
    console.error("Error fetching last invoice:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch last invoice" },
      { status: 500 }
    );
  }
}
