import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { can, createPermissionError } from "@/lib/permissions";
import { logPosAction } from "@/lib/pos-audit";
import { determineSupplyType, computeLineItemGst, roundOff } from "@/lib/gst/advanced";
import { allocateInvoiceNumber } from "@/lib/gst/invoiceNumber";
import { generateInvoiceVerificationQr, generateUpiQrPayload } from "@/lib/invoice/qr";
import { buildEInvoicePayload } from "@/lib/invoice/e-invoice";
// Use crypto.randomUUID() for idempotency keys
function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

const DEMO_TENANT_ID = 1;

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const userId = parseInt(user.userId) || 1;
    const role = user.role as string;

    // Check permission
    if (!can(role, "POS_CHECKOUT")) {
      const error = createPermissionError("POS_CHECKOUT", role);
      await logPosAction("POS_CHECKOUT", userId, DEMO_TENANT_ID, null, {
        allowed: false,
        role,
      });
      return NextResponse.json(error, { status: 403 });
    }

    const body = await req.json();
    const {
      lineItems,
      customerId,
      payments,
      idempotencyKey,
    } = body;

    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 });
    }

    if (!payments || payments.length === 0) {
      return NextResponse.json({ error: "No payment method selected" }, { status: 400 });
    }

    // Check idempotency
    if (idempotencyKey) {
      const existing = await prisma.invoice.findFirst({
        where: { metadata: { path: ["idempotencyKey"], equals: idempotencyKey } },
      });
      if (existing) {
        return NextResponse.json({ invoice: existing, duplicate: true });
      }
    }

    // Get seller GSTIN
    const sellerGstin = await prisma.orgGstin.findFirst({
      where: { isActive: true },
      include: { org: true },
    });

    if (!sellerGstin) {
      return NextResponse.json({ error: "Seller GSTIN not configured" }, { status: 400 });
    }

    // Get customer
    const customer = customerId
      ? await prisma.customer.findUnique({
          where: { id: Number(customerId) },
          include: { loyaltyAccount: true },
        })
      : null;

    // Determine supply type
    const supplyType = determineSupplyType({
      sellerStateCode: sellerGstin.stateCode,
      buyerStateCode: customer?.stateCode || customer?.billingStateCode || null,
      placeOfSupplyPolicy: (sellerGstin.org.placeOfSupplyPolicy as "CUSTOMER_STATE" | "STORE_STATE" | undefined) || "CUSTOMER_STATE",
    });

    // Validate and compute GST for all line items
    const lineCalculations = await Promise.all(
      lineItems.map(async (item: any) => {
        // Validate stock and get batch
        let batch = null;
        if (item.batchId) {
          batch = await prisma.batch.findUnique({ where: { id: item.batchId } });
          if (!batch || batch.quantityOnHand < item.quantity) {
            throw new Error(`Insufficient stock in batch for ${item.productName}`);
          }
        } else if (item.productId) {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            include: { batches: { where: { quantityOnHand: { gt: 0 } }, orderBy: { expiryDate: "asc" } } },
          });
          if (!product) {
            throw new Error(`Product ${item.productName} not found`);
          }
          // Use FIFO - select first batch that has enough stock
          let remainingQty = item.quantity;
          for (const b of product.batches) {
            if (remainingQty <= 0) break;
            if (b.quantityOnHand >= remainingQty) {
              batch = b;
              remainingQty = 0;
              break;
            }
          }
          if (remainingQty > 0) {
            throw new Error(`Insufficient stock for ${item.productName}. Available: ${product.batches.reduce((sum: number, b: any) => sum + b.quantityOnHand, 0)}, Required: ${item.quantity}`);
          }
        }

        // Compute GST
        const calc = await computeLineItemGst(
          {
            productId: item.productId,
            drugLibraryId: item.drugLibraryId,
            batchId: batch?.id || item.batchId,
            hsnCode: item.hsnCode,
            gstRate: item.gstRate,
            gstType: item.gstType,
            pricePaise: item.unitPricePaise,
            quantity: item.quantity,
            discountPaise: item.discountPaise,
            discountPercent: item.discountPercent,
          },
          supplyType
        );

        return { item, calc, batch };
      })
    );

    // Calculate totals
    const totals = lineCalculations.reduce(
      (acc, { calc }) => {
        acc.totalTaxablePaise += calc.taxableValuePaise;
        acc.totalCGSTPaise += calc.cgstPaise;
        acc.totalSGSTPaise += calc.sgstPaise;
        acc.totalIGSTPaise += calc.igstPaise;
        acc.grandTotalPaise += calc.lineTotalPaise;
        return acc;
      },
      {
        totalTaxablePaise: 0,
        totalCGSTPaise: 0,
        totalSGSTPaise: 0,
        totalIGSTPaise: 0,
        grandTotalPaise: 0,
      }
    );

    const roundOffPaise = roundOff(totals.grandTotalPaise);
    totals.grandTotalPaise += roundOffPaise;

    // Validate payments sum
    const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amountPaise, 0);
    if (totalPaid > totals.grandTotalPaise) {
      return NextResponse.json({ error: "Payment amount exceeds invoice total" }, { status: 400 });
    }

    // Check credit limit if credit payment
    const creditPayments = payments.filter((p: any) => p.method === "CREDIT");
    if (creditPayments.length > 0 && customer) {
      const creditAmount = creditPayments.reduce((sum: number, p: any) => sum + p.amountPaise, 0);
      const newBalance = Number(customer.currentCreditBalance) * 100 + creditAmount;
      if (customer.creditLimit && newBalance > Number(customer.creditLimit) * 100) {
        return NextResponse.json(
          { error: `Credit limit exceeded. Current: ₹${(Number(customer.currentCreditBalance)).toFixed(2)}, Limit: ₹${(Number(customer.creditLimit)).toFixed(2)}` },
          { status: 400 }
        );
      }
    }

    // Create invoice in transaction
    const invoice = await prisma.$transaction(async (tx) => {
      // Generate invoice number (within transaction)
      const invoiceNumber = await allocateInvoiceNumber(sellerGstin.id, tx);

      // Deduct inventory
      for (const { item, batch } of lineCalculations) {
        if (batch) {
          await tx.batch.update({
            where: { id: batch.id },
            data: { quantityOnHand: { decrement: item.quantity } },
          });
        } else if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockLevel: { decrement: item.quantity } },
          });
        } else if (item.drugLibraryId) {
          await tx.inventoryItem.updateMany({
            where: {
              drugLibraryId: item.drugLibraryId,
              tenantId: DEMO_TENANT_ID,
              qtyOnHand: { gte: item.quantity },
            },
            data: { qtyOnHand: { decrement: item.quantity } },
          });
        }
      }

      // Create invoice
      const inv = await tx.invoice.create({
        data: {
          tenantId: DEMO_TENANT_ID,
          sellerOrgId: sellerGstin.orgId,
          sellerGstinId: sellerGstin.id,
          customerId: customerId ? Number(customerId) : null,
          buyerName: customer?.name || "Walk-in Customer",
          buyerPhone: customer?.phone || null,
          buyerEmail: customer?.email || null,
          buyerGstin: customer?.gstin || null,
          buyerAddress: customer?.billingAddress || null,
          buyerState: customer?.billingStateCode || customer?.stateCode || null,
          buyerPincode: customer?.billingPincode || null,
          placeOfSupply: sellerGstin.stateCode,
          placeOfSupplyStateCode: customer?.billingStateCode || customer?.stateCode || sellerGstin.stateCode,
          invoiceType: customer?.gstin ? "B2B" : "B2C",
          supplyType,
          status: totalPaid >= totals.grandTotalPaise ? "ISSUED" : "DRAFT",
          invoiceNumber,
          invoiceDate: new Date(),
          totalTaxablePaise: totals.totalTaxablePaise,
          totalGstPaise: totals.totalCGSTPaise + totals.totalSGSTPaise + totals.totalIGSTPaise,
          totalCGSTPaise: totals.totalCGSTPaise,
          totalSGSTPaise: totals.totalSGSTPaise,
          totalIGSTPaise: totals.totalIGSTPaise,
          roundOffPaise,
          totalInvoicePaise: totals.grandTotalPaise,
          paymentStatus: totalPaid >= totals.grandTotalPaise ? "PAID" : totalPaid > 0 ? "PARTIALLY_PAID" : "UNPAID",
          paidAmountPaise: totalPaid,
          paymentMethod: payments.length === 1 ? payments[0].method : "SPLIT",
          metadata: idempotencyKey ? { idempotencyKey } : undefined,
          lineItems: {
            create: lineCalculations.map(({ item, calc, batch }) => ({
              productId: item.productId || null,
              drugLibraryId: item.drugLibraryId || null,
              batchId: batch?.id || null,
              productName: item.productName,
              quantity: item.quantity,
              unitPricePaise: item.unitPricePaise,
              mrpPaise: item.mrpPaise || null,
              salePricePaise: item.salePricePaise || null,
              discountPaise: item.discountPaise || 0,
              discountPercent: item.discountPercent || null,
              hsnCode: calc.hsnCode,
              ean: item.ean || null,
              gstRate: calc.gstRate,
              gstRateBps: Math.round(calc.gstRate * 100),
              gstType: item.gstType || "EXCLUSIVE",
              taxablePaise: calc.taxableValuePaise,
              cgstPaise: calc.cgstPaise,
              sgstPaise: calc.sgstPaise,
              igstPaise: calc.igstPaise,
              lineTotalPaise: calc.lineTotalPaise,
              batchNumber: batch?.batchCode || null,
              expiryDate: batch?.expiryDate || null,
            })),
          },
        },
        include: { lineItems: true, sellerGstin: true, customer: true },
      });

      // Create payments
      const paymentRecords = await Promise.all(
        payments.map((payment: any) => {
          const paymentIdempotencyKey = payment.idempotencyKey || `${idempotencyKey || generateIdempotencyKey()}-${payment.method}-${Date.now()}`;
          return tx.payment.create({
            data: {
              invoiceId: inv.id,
              method: payment.method,
              amountPaise: payment.amountPaise,
              status: payment.method === "CASH" ? "PAID" : payment.method === "CREDIT" ? "PAID" : "INITIATED",
              upiVpa: payment.upiVpa || null,
              upiProvider: payment.upiProvider || null,
              cardLast4: payment.cardLast4 || null,
              cardType: payment.cardType || null,
              walletProvider: payment.walletProvider || null,
              idempotencyKey: paymentIdempotencyKey,
              notes: payment.notes || null,
            },
          });
        })
      );

      // Update customer credit balance if credit payment
      if (creditPayments.length > 0 && customer) {
        const creditAmount = creditPayments.reduce((sum: number, p: any) => sum + p.amountPaise, 0);
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            currentCreditBalance: { increment: creditAmount / 100 },
          },
        });

        // Create credit ledger entry
        await tx.creditLedger.create({
          data: {
            customerId: customer.id,
            invoiceId: inv.id,
            type: "DEBIT",
            amountPaise: creditAmount,
            balanceAfterPaise: Math.round((Number(customer.currentCreditBalance) * 100 + creditAmount)),
            description: `Invoice ${invoiceNumber}`,
          },
        });
      }

      // Generate QR code
      const qrPayload = generateInvoiceVerificationQr({
        invoiceNumber,
        invoiceDate: inv.invoiceDate.toISOString(),
        totalAmount: totals.grandTotalPaise,
        gstin: sellerGstin.gstin,
      });

      // Build e-invoice payload
      const eInvoicePayload = buildEInvoicePayload(
        { ...inv, lineItems },
        sellerGstin,
        sellerGstin.org
      );

      await tx.invoice.update({
        where: { id: inv.id },
        data: {
          qrPayload,
          eInvoicePayload: eInvoicePayload as any,
        },
      });

      return { invoice: inv, payments: paymentRecords };
    });

    // Audit log
    await logPosAction("POS_CHECKOUT", userId, DEMO_TENANT_ID, null, {
      invoiceId: invoice.invoice.id,
      customerId,
      totalPaise: totals.grandTotalPaise,
      itemCount: lineItems.length,
      supplyType,
    });

    return NextResponse.json({
      invoice: invoice.invoice,
      payments: invoice.payments,
    });
  } catch (error: any) {
    console.error("Invoice issue error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to issue invoice" },
      { status: 500 }
    );
  }
}
