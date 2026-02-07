// Home Delivery Management
// GET /api/deliveries - List deliveries
// POST /api/deliveries - Create delivery

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

// GET /api/deliveries
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status");
    const customerId = searchParams.get("customerId");
    const trackingNumber = searchParams.get("trackingNumber");

    const where: any = {
      tenantId: DEMO_TENANT_ID,
    };

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = parseInt(customerId);
    }

    if (trackingNumber) {
      where.trackingNumber = trackingNumber;
    }

    const deliveries = await prisma.delivery.findMany({
      where,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalInvoicePaise: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        deliveryAddress: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      deliveries: deliveries.map((del) => ({
        id: del.id,
        deliveryNumber: del.deliveryNumber,
        invoice: del.invoice,
        customer: del.customer,
        status: del.status,
        scheduledDate: del.scheduledDate,
        dispatchedDate: del.dispatchedDate,
        deliveredDate: del.deliveredDate,
        trackingNumber: del.trackingNumber,
        trackingUrl: del.trackingUrl,
        deliveryAddress: del.deliveryAddress,
        deliveryFeePaise: del.deliveryFeePaise,
      })),
    });
  } catch (error: any) {
    console.error("List deliveries API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/deliveries - Create delivery
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { invoiceId, deliveryAddressId, scheduledDate, deliveryFeePaise, distance } = body;

    if (!invoiceId || !deliveryAddressId) {
      return NextResponse.json(
        { error: "invoiceId and deliveryAddressId are required" },
        { status: 400 }
      );
    }

    // Fetch invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: parseInt(invoiceId) },
      include: {
        customer: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Fetch delivery address
    const deliveryAddress = await prisma.deliveryAddress.findUnique({
      where: { id: parseInt(deliveryAddressId) },
    });

    if (!deliveryAddress) {
      return NextResponse.json(
        { error: "Delivery address not found" },
        { status: 404 }
      );
    }

    // Generate delivery number
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `DEL/${year}-${month}`;

    const lastDelivery = await prisma.delivery.findFirst({
      where: {
        tenantId: DEMO_TENANT_ID,
        deliveryNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        deliveryNumber: "desc",
      },
    });

    let nextNumber = 1;
    if (lastDelivery) {
      const lastNumber = parseInt(lastDelivery.deliveryNumber.split("/")[2] || "0");
      nextNumber = lastNumber + 1;
    }

    const deliveryNumber = `${prefix}/${String(nextNumber).padStart(4, "0")}`;

    // Generate OTP for delivery confirmation
    const otp = generateOTP();
    const otpExpiresAt = new Date();
    otpExpiresAt.setHours(otpExpiresAt.getHours() + 24); // Valid for 24 hours

    // Create delivery
    const delivery = await prisma.delivery.create({
      data: {
        deliveryNumber,
        tenantId: DEMO_TENANT_ID,
        invoiceId: parseInt(invoiceId),
        customerId: invoice.customerId || 0,
        deliveryAddressId: parseInt(deliveryAddressId),
        status: "PENDING",
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        deliveryFeePaise: deliveryFeePaise || 0,
        distance: distance || null,
        otp,
        otpExpiresAt,
        otpVerified: false,
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        deliveryAddress: true,
      },
    });

    return NextResponse.json({
      success: true,
      delivery: {
        id: delivery.id,
        deliveryNumber: delivery.deliveryNumber,
        invoice: delivery.invoice,
        customer: delivery.customer,
        status: delivery.status,
        scheduledDate: delivery.scheduledDate,
        deliveryAddress: delivery.deliveryAddress,
        deliveryFeePaise: delivery.deliveryFeePaise,
        // OTP sent via SMS/WhatsApp (not returned in response for security)
      },
    });
  } catch (error: any) {
    console.error("Create delivery API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}
