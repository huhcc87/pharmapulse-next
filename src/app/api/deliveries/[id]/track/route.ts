// Track Delivery
// GET /api/deliveries/[id]/track

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const deliveryId = parseInt(resolvedParams.id);

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
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
            name: true,
            phone: true,
          },
        },
        deliveryAddress: true,
      },
    });

    if (!delivery) {
      return NextResponse.json(
        { error: "Delivery not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      delivery: {
        id: delivery.id,
        deliveryNumber: delivery.deliveryNumber,
        status: delivery.status,
        scheduledDate: delivery.scheduledDate,
        dispatchedDate: delivery.dispatchedDate,
        deliveredDate: delivery.deliveredDate,
        trackingNumber: delivery.trackingNumber,
        trackingUrl: delivery.trackingUrl,
        deliveryPartner: delivery.deliveryPartner,
        deliveryAddress: delivery.deliveryAddress,
        invoice: delivery.invoice,
      },
    });
  } catch (error: any) {
    console.error("Track delivery API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
