import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { can, createPermissionError } from "@/lib/permissions";
import { logPosAction } from "@/lib/pos-audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const userId = parseInt(user.userId) || 1;
    const role = user.role as string;

    const { id } = await params;
    const invoiceId = parseInt(id);

    if (isNaN(invoiceId)) {
      return NextResponse.json({ error: "Invalid invoice ID" }, { status: 400 });
    }

    const body = await req.json();
    const { payments } = body;

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return NextResponse.json(
        { error: "At least one payment is required" },
        { status: 400 }
      );
    }

    // Get invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        payments: true,
        customer: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Calculate remaining due
    const totalPaid = invoice.payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + p.amountPaise, 0);
    const remainingDue = invoice.totalInvoicePaise - totalPaid;

    // Validate new payments don't exceed due
    const newPaymentsTotal = payments.reduce(
      (sum: number, p: any) => sum + p.amountPaise,
      0
    );

    if (newPaymentsTotal > remainingDue) {
      return NextResponse.json(
        { error: `Payment amount (${newPaymentsTotal / 100}) exceeds remaining due (${remainingDue / 100})` },
        { status: 400 }
      );
    }

    // Check credit limit if credit payment
    const creditPayments = payments.filter((p: any) => p.method === "CREDIT");
    if (creditPayments.length > 0 && invoice.customer) {
      const creditAmount = creditPayments.reduce(
        (sum: number, p: any) => sum + p.amountPaise,
        0
      );
      const currentBalance = Number(invoice.customer.currentCreditBalance) * 100;
      const newBalance = currentBalance + creditAmount;

      if (
        invoice.customer.creditLimit &&
        newBalance > Number(invoice.customer.creditLimit) * 100
      ) {
        return NextResponse.json(
          { error: "Credit limit exceeded" },
          { status: 400 }
        );
      }
    }

    // Create payments in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create payment records
      const paymentRecords = await Promise.all(
        payments.map((payment: any) =>
          tx.payment.create({
            data: {
              invoiceId: invoice.id,
              method: payment.method,
              amountPaise: payment.amountPaise,
              status: payment.method === "CASH" || payment.method === "CREDIT" ? "PAID" : "INITIATED",
              upiVpa: payment.upiVpa || null,
              upiProvider: payment.upiProvider || null,
              cardLast4: payment.cardLast4 || null,
              cardType: payment.cardType || null,
              walletProvider: payment.walletProvider || null,
              notes: payment.notes || null,
            },
          })
        )
      );

      // Update total paid
      const updatedTotalPaid = totalPaid + newPaymentsTotal;
      const newStatus =
        updatedTotalPaid >= invoice.totalInvoicePaise
          ? "PAID"
          : updatedTotalPaid > 0
          ? "PARTIALLY_PAID"
          : invoice.status;

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmountPaise: updatedTotalPaid,
          paymentStatus: newStatus,
          status: newStatus === "PAID" ? "ISSUED" : invoice.status,
        },
      });

      // Update customer credit balance if credit payment
      if (creditPayments.length > 0 && invoice.customer) {
        const creditAmount = creditPayments.reduce(
          (sum: number, p: any) => sum + p.amountPaise,
          0
        );

        await tx.customer.update({
          where: { id: invoice.customer.id },
          data: {
            currentCreditBalance: { increment: creditAmount / 100 },
          },
        });

        // Create credit ledger entry
        await tx.creditLedger.create({
          data: {
            customerId: invoice.customer.id,
            invoiceId: invoice.id,
            type: "DEBIT",
            amountPaise: creditAmount,
            balanceAfterPaise: Math.round(
              (Number(invoice.customer.currentCreditBalance) * 100 + creditAmount)
            ),
            description: `Payment for invoice ${invoice.invoiceNumber || invoice.id}`,
          },
        });
      }

      return { payments: paymentRecords, invoice: await tx.invoice.findUnique({ where: { id: invoice.id } }) };
    });

    // Audit log
    await logPosAction("POS_CHECKOUT", userId, invoice.tenantId, null, {
      action: "RECORD_PAYMENT",
      invoiceId: invoice.id,
      paymentAmount: newPaymentsTotal,
    });

    return NextResponse.json({
      payments: result.payments,
      invoice: result.invoice,
      remainingDue: remainingDue - newPaymentsTotal,
    });
  } catch (error: any) {
    console.error("Record payment error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record payment" },
      { status: 500 }
    );
  }
}
