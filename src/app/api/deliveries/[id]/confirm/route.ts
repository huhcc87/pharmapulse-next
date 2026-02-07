// Confirm Delivery with OTP
// POST /api/deliveries/[id]/confirm

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const deliveryId = parseInt(resolvedParams.id);
    const body = await req.json();
    const { otp } = body;

    if (!otp) {
      return NextResponse.json(
        { error: "OTP is required" },
        { status: 400 }
      );
    }

    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      return NextResponse.json(
        { error: "Delivery not found" },
        { status: 404 }
      );
    }

    if (delivery.status === "DELIVERED") {
      return NextResponse.json(
        { error: "Delivery already confirmed" },
        { status: 400 }
      );
    }

    // Verify OTP
    if (!delivery.otp || delivery.otp !== otp) {
      return NextResponse.json(
        { error: "Invalid OTP" },
        { status: 400 }
      );
    }

    if (delivery.otpExpiresAt && new Date() > delivery.otpExpiresAt) {
      return NextResponse.json(
        { error: "OTP has expired" },
        { status: 400 }
      );
    }

    // Update delivery status
    const updatedDelivery = await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: "DELIVERED",
        deliveredDate: new Date(),
        otpVerified: true,
        otpVerifiedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      delivery: {
        id: updatedDelivery.id,
        deliveryNumber: updatedDelivery.deliveryNumber,
        status: updatedDelivery.status,
        deliveredDate: updatedDelivery.deliveredDate,
      },
    });
  } catch (error: any) {
    console.error("Confirm delivery API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
