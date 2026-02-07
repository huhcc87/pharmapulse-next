// src/app/api/payments/[id]/status/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, upiTxnId, txnRef, notes } = body;

    if (!status) {
      return NextResponse.json(
        { error: "status is required" },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.findUnique({
      where: { id: Number(id) },
      include: { invoice: true },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const oldStatus = payment.status;

    // Update payment
    const updated = await prisma.payment.update({
      where: { id: Number(id) },
      data: {
        status: status as any,
        upiTxnId: upiTxnId || payment.upiTxnId,
        txnRef: txnRef || payment.txnRef,
        txnDate: status === "PAID" ? new Date() : payment.txnDate,
        notes: notes || payment.notes,
      },
      include: { invoice: true },
    });

    // Update invoice payment status
    const invoicePayments = await prisma.payment.findMany({
      where: { invoiceId: payment.invoiceId },
    });

    const totalPaid = invoicePayments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + p.amountPaise, 0);

    const invoiceTotal = payment.invoice.totalInvoicePaise;
    let invoicePaymentStatus = "UNPAID";
    if (totalPaid >= invoiceTotal) {
      invoicePaymentStatus = "PAID";
    } else if (totalPaid > 0) {
      invoicePaymentStatus = "PARTIALLY_PAID";
    }

    await prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        paymentStatus: invoicePaymentStatus,
        paidAmountPaise: totalPaid,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: payment.invoice.tenantId,
        branchId: payment.invoice.branchId,
        action: "PAYMENT_STATUS_UPDATED",
        entity: "Payment",
        entityId: payment.id,
        beforeJson: JSON.stringify({ status: oldStatus }),
        afterJson: JSON.stringify({ status, upiTxnId, txnRef }),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Payment status update error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update payment status" },
      { status: 500 }
    );
  }
}

