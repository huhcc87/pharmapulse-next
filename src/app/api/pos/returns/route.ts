// src/app/api/pos/returns/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { originalInvoiceId, lineItems, reason, refundMethod } = body;

    if (!originalInvoiceId || !lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { error: "originalInvoiceId and lineItems are required" },
        { status: 400 }
      );
    }

    const originalInvoice = await prisma.invoice.findUnique({
      where: { id: Number(originalInvoiceId) },
      include: { lineItems: true, sellerGstin: true },
    });

    if (!originalInvoice) {
      return NextResponse.json({ error: "Original invoice not found" }, { status: 404 });
    }

    // Create return invoice (credit note)
    const returnInvoice = await prisma.$transaction(async (tx) => {
      // Restock inventory
      for (const returnItem of lineItems) {
        const originalLineItem = originalInvoice.lineItems.find(
          (li) => li.id === returnItem.lineItemId
        );

        if (!originalLineItem) continue;

        // Restock to batch if available
        if (originalLineItem.batchId) {
          await tx.batch.update({
            where: { id: originalLineItem.batchId },
            data: { quantityOnHand: { increment: returnItem.quantity } },
          });
        } else if (originalLineItem.drugLibraryId) {
          // Restock to inventory item
          const inventoryItem = await tx.inventoryItem.findFirst({
            where: {
              drugLibraryId: originalLineItem.drugLibraryId,
              tenantId: DEMO_TENANT_ID,
              batchCode: originalLineItem.batchNumber || "RETURN",
            },
          });

          if (inventoryItem) {
            await tx.inventoryItem.update({
              where: { id: inventoryItem.id },
              data: { qtyOnHand: { increment: returnItem.quantity } },
            });
          } else {
            // Create new inventory item for returns
            await tx.inventoryItem.create({
              data: {
                tenantId: DEMO_TENANT_ID,
                drugLibraryId: originalLineItem.drugLibraryId,
                qtyOnHand: returnItem.quantity,
                batchCode: originalLineItem.batchNumber || "RETURN",
                expiryDate: originalLineItem.expiryDate,
              },
            });
          }
        }
      }

      // Calculate return totals (negative)
      const returnTotal = lineItems.reduce((sum: number, item: any) => {
        const originalLine = originalInvoice.lineItems.find((li) => li.id === item.lineItemId);
        if (!originalLine) return sum;
        return sum - (originalLine.unitPricePaise * item.quantity);
      }, 0);

      // Create credit note invoice
      const creditNote = await tx.invoice.create({
        data: {
          tenantId: DEMO_TENANT_ID,
          sellerOrgId: originalInvoice.sellerOrgId,
          sellerGstinId: originalInvoice.sellerGstinId,
          customerId: originalInvoice.customerId,
          originalInvoiceId: originalInvoice.id,
          invoiceType: "CREDIT_NOTE",
          status: "ISSUED",
          buyerName: originalInvoice.buyerName,
          buyerPhone: originalInvoice.buyerPhone,
          buyerEmail: originalInvoice.buyerEmail,
          placeOfSupply: originalInvoice.placeOfSupply,
          totalInvoicePaise: Math.abs(returnTotal),
          totalTaxablePaise: Math.abs(returnTotal),
          totalGstPaise: 0, // Simplified
          notes: `Return/Refund: ${reason || "Customer return"}`,
          lineItems: {
            create: lineItems.map((item: any) => {
              const originalLine = originalInvoice.lineItems.find((li) => li.id === item.lineItemId);
              if (!originalLine) return null;
              return {
                productId: originalLine.productId,
                drugLibraryId: originalLine.drugLibraryId,
                batchId: originalLine.batchId,
                productName: originalLine.productName,
                quantity: item.quantity,
                unitPricePaise: -originalLine.unitPricePaise, // Negative for credit note
                hsnCode: originalLine.hsnCode,
                batchNumber: originalLine.batchNumber,
                expiryDate: originalLine.expiryDate,
                taxablePaise: -originalLine.taxablePaise,
                gstRateBps: originalLine.gstRateBps,
                cgstPaise: -originalLine.cgstPaise,
                sgstPaise: -originalLine.sgstPaise,
                igstPaise: -originalLine.igstPaise,
              };
            }).filter(Boolean) as any,
          },
        },
        include: { lineItems: true },
      });

      // Create refund payment
      if (refundMethod) {
        await tx.payment.create({
          data: {
            invoiceId: creditNote.id,
            method: refundMethod as any,
            amountPaise: Math.abs(returnTotal),
            status: "PAID", // Refund processed
            notes: `Refund for invoice #${originalInvoiceId}`,
          },
        });
      }

      return creditNote;
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: DEMO_TENANT_ID,
        action: "RETURN_PROCESSED",
        entity: "Invoice",
        entityId: returnInvoice.id,
        afterJson: JSON.stringify({
          originalInvoiceId,
          returnInvoiceId: returnInvoice.id,
          reason,
        }),
      },
    });

    return NextResponse.json({ creditNote: returnInvoice });
  } catch (error: any) {
    console.error("Return processing error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process return" },
      { status: 500 }
    );
  }
}

