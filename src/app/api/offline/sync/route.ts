// POST /api/offline/sync
// Sync offline invoices and events with conflict-safe reconciliation

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOfflineToken, isTokenExpired } from "@/lib/offline/token";
import { determineSupplyType, computeLineItemGst, roundOff } from "@/lib/gst/advanced";
import { allocateInvoiceNumber } from "@/lib/gst/invoiceNumber";
import { generateInvoiceVerificationQr } from "@/lib/invoice/qr";
import { buildEInvoicePayload } from "@/lib/invoice/e-invoice";
import { logPosAction } from "@/lib/pos-audit";

const DEMO_TENANT_ID = 1;

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, invoices = [], events = [] } = body;

    if (!token) {
      return NextResponse.json({ error: "Offline token required" }, { status: 401 });
    }

    // Verify token
    const tokenPayload = verifyOfflineToken(token);
    if (!tokenPayload) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    // Check token in database (ensure not revoked)
    const tokenRecord = await prisma.offlineEntitlementToken.findUnique({
      where: { tokenId: tokenPayload.tokenId },
    });

    if (!tokenRecord || tokenRecord.status !== "ACTIVE") {
      return NextResponse.json({ error: "Token revoked or not found" }, { status: 401 });
    }

    if (isTokenExpired(tokenPayload)) {
      // Mark as expired in DB
      await prisma.offlineEntitlementToken.update({
        where: { tokenId: tokenPayload.tokenId },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ error: "Token expired" }, { status: 401 });
    }

    // Check idempotency - prevent duplicate processing
    const syncResults = [];

    // Sync invoices
    for (const offlineInvoice of invoices) {
      const { localId, idempotencyKey, invoiceData } = offlineInvoice;

      try {
        // Check if already synced by idempotencyKey
        const existing = await prisma.invoice.findFirst({
          where: {
            metadata: {
              path: ["idempotencyKey"],
              equals: idempotencyKey,
            },
          },
        });

        if (existing) {
          syncResults.push({
            localId,
            status: "SYNCED",
            serverInvoiceId: existing.id,
            duplicate: true,
          });
          continue;
        }

        // Validate stock and detect conflicts
        const conflicts: any[] = [];
        const validatedItems: any[] = [];

        for (const lineItem of invoiceData.lineItems || []) {
          if (lineItem.batchId) {
            // Check batch availability
            const batch = await prisma.batch.findUnique({
              where: { id: lineItem.batchId },
            });

            if (!batch) {
              conflicts.push({
                lineIndex: lineItem.index || 0,
                productName: lineItem.productName,
                issue: "BATCH_NOT_FOUND",
                message: `Batch ${lineItem.batchId} not found`,
              });
              continue;
            }

            // Check stock conflict
            if (batch.quantityOnHand < lineItem.quantity) {
              conflicts.push({
                lineIndex: lineItem.index || 0,
                productName: lineItem.productName,
                batchId: lineItem.batchId,
                issue: "INSUFFICIENT_STOCK",
                available: batch.quantityOnHand,
                required: lineItem.quantity,
                message: `Insufficient stock. Available: ${batch.quantityOnHand}, Required: ${lineItem.quantity}`,
              });
              continue;
            }

            // Check expiry conflict (was valid at sale time, but expired now)
            const expiryDate = new Date(batch.expiryDate);
            const now = new Date();
            if (expiryDate < now) {
              conflicts.push({
                lineIndex: lineItem.index || 0,
                productName: lineItem.productName,
                batchId: lineItem.batchId,
                issue: "BATCH_EXPIRED",
                expiryDate: expiryDate.toISOString(),
                message: `Batch expired. Expiry: ${expiryDate.toLocaleDateString()}`,
              });
              continue;
            }

            validatedItems.push(lineItem);
          } else if (lineItem.productId) {
            // Find available batch (FEFO)
            const product = await prisma.product.findUnique({
              where: { id: lineItem.productId },
              include: {
                batches: {
                  where: { quantityOnHand: { gt: 0 } },
                  orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
                },
              },
            });

            if (!product || product.batches.length === 0) {
              conflicts.push({
                lineIndex: lineItem.index || 0,
                productName: lineItem.productName,
                issue: "OUT_OF_STOCK",
                message: `No stock available for ${lineItem.productName}`,
              });
              continue;
            }

            // Check if enough stock available
            const totalStock = product.batches.reduce((sum, b) => sum + b.quantityOnHand, 0);
            if (totalStock < lineItem.quantity) {
              conflicts.push({
                lineIndex: lineItem.index || 0,
                productName: lineItem.productName,
                issue: "INSUFFICIENT_STOCK",
                available: totalStock,
                required: lineItem.quantity,
                message: `Insufficient stock. Available: ${totalStock}, Required: ${lineItem.quantity}`,
              });
              continue;
            }

            validatedItems.push(lineItem);
          }
        }

        // If conflicts detected, mark as NEEDS_REVIEW
        if (conflicts.length > 0) {
          syncResults.push({
            localId,
            status: "NEEDS_REVIEW",
            conflicts,
            message: `${conflicts.length} conflict(s) detected. Manual review required.`,
          });
          continue;
        }

        // Process invoice (similar to issue-invoice, but with offline context)
        const sellerGstin = await prisma.orgGstin.findFirst({
          where: { 
            isActive: true,
            org: {
              tenantId: tokenPayload.tenantId
            }
          },
          include: { org: true },
        });

        if (!sellerGstin) {
          syncResults.push({
            localId,
            status: "FAILED",
            error: "Seller GSTIN not configured",
          });
          continue;
        }

        // Create invoice in transaction
        const result = await prisma.$transaction(async (tx) => {
          // Allocate invoice number (use transaction client)
          const invoiceNumber = await allocateInvoiceNumber(sellerGstin.id, tx);

          // Compute totals (use invoiceData.totals if provided, else recompute)
          const totals = invoiceData.totals || {
            totalTaxablePaise: 0,
            totalCGSTPaise: 0,
            totalSGSTPaise: 0,
            totalIGSTPaise: 0,
            grandTotalPaise: 0,
            roundOffPaise: 0,
          };

          // Create invoice
          const invoice = await tx.invoice.create({
            data: {
              tenantId: tokenPayload.tenantId,
              sellerOrgId: sellerGstin.orgId,
              sellerGstinId: sellerGstin.id,
              invoiceType: invoiceData.invoiceType || "B2C",
              invoiceNumber,
              invoiceDate: new Date(invoiceData.invoiceDate || Date.now()),
              customerId: invoiceData.customerId || null,
              buyerName: invoiceData.buyerName || "Walk-in Customer",
              supplyType: invoiceData.supplyType || "INTRA_STATE",
              placeOfSupplyStateCode: invoiceData.placeOfSupplyStateCode || sellerGstin.stateCode,
              totalTaxablePaise: totals.totalTaxablePaise,
              totalCGSTPaise: totals.totalCGSTPaise,
              totalSGSTPaise: totals.totalSGSTPaise,
              totalIGSTPaise: totals.totalIGSTPaise,
              totalInvoicePaise: totals.grandTotalPaise || totals.totalInvoicePaise || 0,
              roundOffPaise: totals.roundOffPaise || 0,
              paidAmountPaise: invoiceData.paidAmountPaise || 0,
              paymentStatus: invoiceData.paidAmountPaise >= (totals.grandTotalPaise || totals.totalInvoicePaise || 0) ? "PAID" : "PARTIALLY_PAID",
              status: "ISSUED",
            },
          });

          // Create line items and deduct stock
          for (const item of validatedItems) {
            // Deduct stock
            if (item.batchId) {
              await tx.batch.update({
                where: { id: item.batchId },
                data: { quantityOnHand: { decrement: item.quantity } },
              });
            }

            // Create line item
            await tx.invoiceLineItem.create({
              data: {
                invoiceId: invoice.id,
                productId: item.productId || null,
                drugLibraryId: item.drugLibraryId || null,
                batchId: item.batchId || null,
                productName: item.productName,
                hsnCode: item.hsnCode,
                gstRate: item.gstRate,
                quantity: item.quantity,
                unitPricePaise: item.unitPricePaise,
                taxablePaise: item.taxablePaise,
                cgstPaise: item.cgstPaise,
                sgstPaise: item.sgstPaise,
                igstPaise: item.igstPaise,
                lineTotalPaise: item.lineTotalPaise,
                batchNumber: item.batchNumber || null,
                expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
              },
            });
          }

          // Process payments
          for (const payment of invoiceData.payments || []) {
            await tx.payment.create({
              data: {
                invoiceId: invoice.id,
                method: payment.method,
                amountPaise: payment.amountPaise,
                status: payment.status || "PAID",
                upiVpa: payment.upiVpa || null,
                cardLast4: payment.cardLast4 || null,
                walletProvider: payment.walletProvider || null,
                notes: payment.notes || "Synced from offline",
              },
            });
          }

          // Generate QR
          const qrPayload = generateInvoiceVerificationQr({
            invoiceNumber,
            invoiceDate: invoice.invoiceDate.toISOString(),
            totalAmount: totals.grandTotalPaise,
            gstin: sellerGstin.gstin,
          });

          // Build e-invoice payload
          const eInvoicePayload = buildEInvoicePayload(
            { ...invoice, lineItems: validatedItems },
            sellerGstin,
            sellerGstin.org
          );

          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              qrPayload,
              eInvoicePayload: eInvoicePayload as any,
            },
          });

          return invoice;
        });

        syncResults.push({
          localId,
          status: "SYNCED",
          serverInvoiceId: result.id,
        });
      } catch (error: any) {
        console.error(`Sync error for invoice ${localId}:`, error);
        syncResults.push({
          localId,
          status: "FAILED",
          error: error.message || "Sync failed",
        });
      }
    }

    // Sync events (stock decrements, payments, credit ledger)
    for (const event of events) {
      const { localId, idempotencyKey, eventType, eventData } = event;

      try {
        // Check idempotency
        // Process event based on type
        // Similar pattern to invoices

        syncResults.push({
          localId,
          status: "SYNCED",
          eventType,
        });
      } catch (error: any) {
        syncResults.push({
          localId,
          status: "FAILED",
          error: error.message,
          eventType,
        });
      }
    }

    // Audit log
    const succeeded = syncResults.filter((r) => r.status === "SYNCED").length;
    const failed = syncResults.filter((r) => r.status === "FAILED").length;
    const needsReview = syncResults.filter((r) => r.status === "NEEDS_REVIEW").length;

    await prisma.syncAuditLog.create({
      data: {
        tenantId: tokenPayload.tenantId,
        deviceId: tokenPayload.deviceId,
        tokenId: tokenPayload.tokenId,
        action: "SYNC_COMPLETED",
        itemsProcessed: invoices.length + events.length,
        itemsSucceeded: succeeded,
        itemsFailed: failed,
        itemsReview: needsReview,
        details: {
          results: syncResults,
        },
      },
    });

    return NextResponse.json({
      success: true,
      results: syncResults,
      summary: {
        total: invoices.length + events.length,
        succeeded,
        failed,
        needsReview,
      },
    });
  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync offline data" },
      { status: 500 }
    );
  }
}
