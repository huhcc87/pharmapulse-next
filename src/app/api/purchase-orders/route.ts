// Purchase Order Management API
// GET /api/purchase-orders - List POs
// POST /api/purchase-orders - Create PO

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

// GET /api/purchase-orders - List purchase orders
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");
    const vendorId = searchParams.get("vendorId");

    const where: any = {
      tenantId: DEMO_TENANT_ID,
    };

    if (status) {
      where.status = status;
    }

    if (vendorId) {
      where.vendorId = parseInt(vendorId);
    }

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            gstin: true,
          },
        },
        lineItems: true,
        _count: {
          select: {
            grns: true,
          },
        },
      },
      orderBy: {
        poDate: "desc",
      },
    });

    return NextResponse.json({
      purchaseOrders: purchaseOrders.map((po) => ({
        id: po.id,
        poNumber: po.poNumber,
        vendor: po.vendor,
        poDate: po.poDate,
        expectedDate: po.expectedDate,
        status: po.status,
        totalAmountPaise: po.totalAmountPaise,
        lineItems: po.lineItems,
        grnCount: (po as any)._count?.grns || 0, // Use _count if available, otherwise 0
      })),
    });
  } catch (error: any) {
    console.error("List purchase orders API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/purchase-orders - Create purchase order
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const userId = parseInt(user.userId || "1");
    const body = await req.json();
    const { vendorId, expectedDate, lineItems, notes } = body;

    if (!vendorId) {
      return NextResponse.json(
        { error: "vendorId is required" },
        { status: 400 }
      );
    }

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { error: "lineItems array is required" },
        { status: 400 }
      );
    }

    // Validate vendor
    const vendor = await prisma.vendor.findUnique({
      where: { id: parseInt(vendorId) },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    // Generate PO number
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `PO/${year}-${month}`;

    const lastPO = await prisma.purchaseOrder.findFirst({
      where: {
        tenantId: DEMO_TENANT_ID,
        poNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        poNumber: "desc",
      },
    });

    let nextNumber = 1;
    if (lastPO) {
      const lastNumber = parseInt(lastPO.poNumber.split("/")[2] || "0");
      nextNumber = lastNumber + 1;
    }

    const poNumber = `${prefix}/${String(nextNumber).padStart(4, "0")}`;

    // Calculate totals
    let totalAmountPaise = 0;
    let totalCGSTPaise = 0;
    let totalSGSTPaise = 0;
    let totalIGSTPaise = 0;

    const poLineItems = await Promise.all(
      lineItems.map(async (item: any) => {
        const lineTotal = item.unitPricePaise * item.quantity;
        const gstRate = item.gstRate || 12;
        const taxable = Math.round(lineTotal / (1 + gstRate / 100));
        const gst = lineTotal - taxable;

        // Assume intra-state for now (can be determined based on vendor state)
        const cgst = Math.round(gst / 2);
        const sgst = gst - cgst;

        totalAmountPaise += lineTotal;
        totalCGSTPaise += cgst;
        totalSGSTPaise += sgst;

        return {
          productId: item.productId || null,
          drugLibraryId: item.drugLibraryId || null,
          productName: item.productName,
          hsnCode: item.hsnCode || "3004",
          quantity: item.quantity,
          unitPricePaise: item.unitPricePaise,
          gstRate: gstRate,
          taxablePaise: taxable,
          cgstPaise: cgst,
          sgstPaise: sgst,
          igstPaise: 0,
          lineTotalPaise: lineTotal,
        };
      })
    );

    // Create PO
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        tenantId: DEMO_TENANT_ID,
        vendorId: parseInt(vendorId),
        poDate: new Date(),
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        status: "DRAFT",
        totalAmountPaise,
        totalCGSTPaise,
        totalSGSTPaise,
        totalIGSTPaise,
        requestedBy: userId,
        notes: notes || null,
        lineItems: {
          create: poLineItems,
        },
      },
      include: {
        vendor: true,
        lineItems: true,
      },
    });

    return NextResponse.json({
      success: true,
      purchaseOrder: {
        id: purchaseOrder.id,
        poNumber: purchaseOrder.poNumber,
        vendor: purchaseOrder.vendor,
        poDate: purchaseOrder.poDate,
        status: purchaseOrder.status,
        totalAmountPaise: purchaseOrder.totalAmountPaise,
        lineItems: purchaseOrder.lineItems,
      },
    });
  } catch (error: any) {
    console.error("Create purchase order API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
