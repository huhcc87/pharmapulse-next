// src/app/api/payments/upi/create-qr/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_UPI_VPA = process.env.DEMO_UPI_VPA || "yourstore@upi";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { invoiceId, amountPaise, upiVpa, upiProvider = "OTHER" } = body;

    if (!invoiceId || !amountPaise) {
      return NextResponse.json(
        { error: "invoiceId and amountPaise are required" },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: Number(invoiceId) },
      include: { sellerGstin: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const vpa = upiVpa || DEMO_UPI_VPA;
    const amount = (amountPaise / 100).toFixed(2);
    const merchantName = invoice.sellerGstin?.legalName || "PharmaPulse Store";
    
    // Generate UPI QR payload (UPI standard format)
    const upiPayload = `upi://pay?pa=${encodeURIComponent(vpa)}&am=${amount}&cu=INR&tn=${encodeURIComponent(merchantName)}&tr=${invoiceId}-${Date.now()}`;

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        invoiceId: Number(invoiceId),
        method: "UPI",
        amountPaise: Number(amountPaise),
        status: "PENDING",
        upiVpa: vpa,
        upiProvider: upiProvider as any,
        upiQrPayload: upiPayload,
        upiQrGeneratedAt: new Date(),
      },
    });

    // QR code image will be generated on frontend using qrcode.react
    // For now, return payload only

    // Log audit
    await prisma.auditLog.create({
      data: {
        tenantId: invoice.tenantId,
        branchId: invoice.branchId,
        action: "UPI_QR_GENERATED",
        entity: "Payment",
        entityId: payment.id,
        afterJson: JSON.stringify({
          invoiceId,
          amountPaise,
          upiVpa: vpa,
        }),
      },
    });

    return NextResponse.json({
      qrPayload: upiPayload,
      paymentId: payment.id,
      amountPaise: payment.amountPaise,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min expiry
    });
  } catch (error: any) {
    console.error("UPI QR creation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create UPI QR" },
      { status: 500 }
    );
  }
}

