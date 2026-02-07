// src/app/api/pos/checkout/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeInvoice } from "@/lib/gst/computeInvoice";
import { gstStateFromGstin } from "@/lib/gstStateCodes";
import { calculateGst, calculateInvoiceTotals } from "@/lib/gst/taxCalculator";
import { allocateInvoiceNumber } from "@/lib/gst/invoiceNumber";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { can, createPermissionError } from "@/lib/permissions";
import { logPosAction } from "@/lib/pos-audit";
import { validateScheduleHDrugs, logScheduleHSale, canOverrideScheduleH } from "@/lib/compliance/schedule-h";
import { calculateTCS } from "@/lib/gst/tcs-calculator";
import { getCurrentFinancialYear } from "@/lib/gst/invoiceNumber";

const DEMO_TENANT_ID = 1;

export async function POST(req: Request) {
  try {
    // Check permissions
    const user = await getSessionUser();
    requireAuth(user);

    const userId = parseInt(user.userId) || 1;
    const role = user.role as string;

    // Check if user can checkout
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
      customerId,
      prescriptionId,
      lineItems,
      payments,
      discounts,
      sendReceiptSms,
      sendReceiptEmail,
    } = body;

    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 });
    }

    if (!payments || payments.length === 0) {
      return NextResponse.json({ error: "No payment method selected" }, { status: 400 });
    }

    // Get default GSTIN
    let sellerGstin = await prisma.orgGstin.findFirst({
      where: { isActive: true },
    });

    if (!sellerGstin) {
      const org = await prisma.org.findFirst({ where: { tenantId: DEMO_TENANT_ID } });
      if (!org) {
        await prisma.org.create({
          data: { tenantId: DEMO_TENANT_ID, name: "Demo Pharmacy", role: "RETAILER" },
        });
      }
      sellerGstin = await prisma.orgGstin.create({
        data: {
          orgId: (await prisma.org.findFirst({ where: { tenantId: DEMO_TENANT_ID } }))!.id,
          gstin: "27AAAAA0000A1Z5",
          stateCode: "27",
          legalName: "Demo Pharmacy",
          isActive: true,
          invoicePrefix: "INV",
          nextInvoiceNo: 1,
        },
      });
    }

    // Get customer if provided
    let customer = null;
    if (customerId) {
      customer = await prisma.customer.findUnique({
        where: { id: Number(customerId) },
        include: { loyaltyAccount: true },
      });
    }

    // Get prescription if provided
    let prescription = null;
    if (prescriptionId) {
      prescription = await prisma.prescription.findUnique({
        where: { id: Number(prescriptionId) },
        include: { lines: true },
      });
    }

    // Validate Schedule H drug compliance
    const scheduleHValidation = await validateScheduleHDrugs({
      lineItems,
      prescriptionId: prescriptionId ? Number(prescriptionId) : undefined,
      prescriptionLines: prescription?.lines.map(line => ({
        drugLibraryId: line.drugLibraryId || undefined,
        productId: line.productId || undefined,
        medicationName: line.medicationName,
        quantity: line.quantity,
      })),
      customerId: customerId ? Number(customerId) : undefined,
    });

    // Check for validation errors
    if (!scheduleHValidation.isValid) {
      // Check if user can override
      const canOverride = await canOverrideScheduleH(userId, role);
      
      if (!canOverride) {
        // Log failed validation attempt
        await logPosAction("POS_DISPENSE_SCHEDULE", userId, DEMO_TENANT_ID, null, {
          allowed: false,
          validationErrors: scheduleHValidation.errors,
          role,
        });

        return NextResponse.json(
          {
            error: "Schedule H drug compliance validation failed",
            errors: scheduleHValidation.errors,
            warnings: scheduleHValidation.warnings,
            requiresPrescription: true,
            canOverride: false,
          },
          { status: 400 }
        );
      }

      // User can override, but log it
      await logPosAction("POS_DISPENSE_SCHEDULE", userId, DEMO_TENANT_ID, null, {
        allowed: true,
        override: true,
        validationErrors: scheduleHValidation.errors,
        overrideBy: userId,
        role,
      });
    }

    // Log warnings (non-blocking)
    if (scheduleHValidation.warnings.length > 0) {
      await logPosAction("POS_DISPENSE_SCHEDULE", userId, DEMO_TENANT_ID, null, {
        warnings: scheduleHValidation.warnings,
        role,
      });
    }

    // Validate inventory and get batches (FIFO)
    const validatedItems = await Promise.all(
      lineItems.map(async (item: any) => {
        if (item.productId) {
          // Check Product inventory
          const product = await prisma.product.findUnique({
            where: { id: Number(item.productId) },
            include: { batches: { where: { quantityOnHand: { gt: 0 } }, orderBy: { expiryDate: "asc" } } },
          });

          if (!product) {
            throw new Error(`Product ${item.productName} not found`);
          }

          let remainingQty = item.quantity;
          const batchesToUse: Array<{ batchId: number; qty: number; batchCode: string; expiryDate: Date }> = [];

          for (const batch of product.batches) {
            if (remainingQty <= 0) break;
            const qtyFromBatch = Math.min(remainingQty, batch.quantityOnHand);
            batchesToUse.push({
              batchId: batch.id,
              qty: qtyFromBatch,
              batchCode: batch.batchCode,
              expiryDate: batch.expiryDate,
            });
            remainingQty -= qtyFromBatch;
          }

          if (remainingQty > 0) {
            throw new Error(`Insufficient stock for ${item.productName}. Available: ${item.quantity - remainingQty}, Required: ${item.quantity}`);
          }

          return { ...item, batchesToUse, productId: product.id };
        } else if (item.drugLibraryId) {
          // Check InventoryItem (DrugLibrary)
          const inventoryItem = await prisma.inventoryItem.findFirst({
            where: {
              drugLibraryId: Number(item.drugLibraryId),
              tenantId: DEMO_TENANT_ID,
              qtyOnHand: { gte: item.quantity },
            },
            orderBy: { expiryDate: "asc" }, // FIFO by expiry
          });

          if (!inventoryItem) {
            throw new Error(`Insufficient stock for ${item.productName}`);
          }

          return { ...item, inventoryItemId: inventoryItem.id };
        }

        return item;
      })
    );

    // Validate GST fields for all items
    for (const item of validatedItems) {
      if (!item.hsnCode) {
        return NextResponse.json(
          { error: `HSN code missing for ${item.productName}` },
          { status: 400 }
        );
      }
      if (item.gstRate === undefined || item.gstRate === null) {
        return NextResponse.json(
          { error: `GST rate missing for ${item.productName}` },
          { status: 400 }
        );
      }
    }

    // Compute invoice totals using tax calculator
    const placeOfSupply = sellerGstin.stateCode || "27";
    const intraState = true; // Simplified for MVP

    // Calculate tax for each line item
    const taxCalculations = validatedItems.map((item: any) =>
      calculateGst({
        pricePaise: item.unitPricePaise,
        gstRate: item.gstRate || Number(item.gstRateBps) / 100 || 12,
        gstType: item.gstType || "EXCLUSIVE",
        quantity: item.quantity,
        discountPaise: item.discountPaise,
        discountPercent: item.discountPercent,
      })
    );

    const invoiceTotals = calculateInvoiceTotals(taxCalculations, intraState);

    // Apply global discounts
    let finalTotal = invoiceTotals.grandTotalPaise;
    if (discounts?.globalDiscountPaise) {
      finalTotal -= discounts.globalDiscountPaise;
    } else if (discounts?.globalDiscountPercent) {
      finalTotal -= Math.round((finalTotal * Number(discounts.globalDiscountPercent)) / 100);
    }
    if (discounts?.couponDiscountPaise) {
      finalTotal -= discounts.couponDiscountPaise;
    }

    // Calculate TCS (Tax Collected at Source) for B2B transactions
    const isB2B = !!customer?.gstin;
    const financialYear = getCurrentFinancialYear();
    const tcsCalculation = calculateTCS({
      invoiceValuePaise: finalTotal,
      customerGstin: customer?.gstin || null,
      isB2B,
      customerId: customerId ? Number(customerId) : undefined,
      financialYear,
    });

    // Add TCS to final total if applicable
    if (tcsCalculation.isApplicable) {
      finalTotal += tcsCalculation.tcsAmountPaise;
    }

    // Create invoice
    const invoice = await prisma.$transaction(async (tx) => {
      // Generate invoice number (within transaction)
      const invoiceNumber = await allocateInvoiceNumber(sellerGstin.id, tx);
      
      // Decrement inventory
      for (const item of validatedItems) {
        if (item.batchesToUse) {
          // Product batches
          for (const batchUse of item.batchesToUse) {
            await tx.batch.update({
              where: { id: batchUse.batchId },
              data: { quantityOnHand: { decrement: batchUse.qty } },
            });
          }
        } else if (item.inventoryItemId) {
          // InventoryItem
          await tx.inventoryItem.update({
            where: { id: item.inventoryItemId },
            data: { qtyOnHand: { decrement: item.quantity } },
          });
        }
      }

      // Create invoice with GST-compliant fields
      const inv = await tx.invoice.create({
        data: {
          tenantId: DEMO_TENANT_ID,
          sellerOrgId: sellerGstin.orgId,
          sellerGstinId: sellerGstin.id,
          customerId: customerId ? Number(customerId) : null,
          prescriptionId: prescriptionId ? Number(prescriptionId) : null,
          buyerName: customer?.name || "Walk-in Customer",
          buyerPhone: customer?.phone || null,
          buyerEmail: customer?.email || null,
          buyerGstin: customer?.gstin || null,
          placeOfSupply,
          invoiceType: customer?.gstin ? "B2B" : "B2C",
          status: "ISSUED",
          invoiceNumber,
          invoiceDate: new Date(),
          totalTaxablePaise: invoiceTotals.totalTaxablePaise,
          totalGstPaise: invoiceTotals.totalGstPaise,
          totalCGSTPaise: invoiceTotals.totalCGSTPaise,
          totalSGSTPaise: invoiceTotals.totalSGSTPaise,
          totalIGSTPaise: invoiceTotals.totalIGSTPaise,
          totalInvoicePaise: finalTotal,
          // TCS fields (will be added to schema)
          // tcsAmountPaise: tcsCalculation.isApplicable ? tcsCalculation.tcsAmountPaise : 0,
          // tcsRate: tcsCalculation.isApplicable ? tcsCalculation.tcsRate : null,
          globalDiscountPaise: discounts?.globalDiscountPaise || 0,
          globalDiscountPercent: discounts?.globalDiscountPercent ? Number(discounts.globalDiscountPercent) : null,
          couponCode: discounts?.couponCode || null,
          couponDiscountPaise: discounts?.couponDiscountPaise || 0,
          receiptSentViaSms: sendReceiptSms || false,
          receiptSentViaEmail: sendReceiptEmail || false,
          lineItems: {
            create: validatedItems.map((item: any, idx: number) => {
              const batchUse = item.batchesToUse?.[0]; // Use first batch for line item
              const taxCalc = taxCalculations[idx];
              return {
                productId: item.productId || null,
                drugLibraryId: item.drugLibraryId ? Number(item.drugLibraryId) : null,
                batchId: batchUse?.batchId || null,
                productName: item.productName,
                quantity: item.quantity,
                unitPricePaise: item.unitPricePaise,
                discountPaise: item.discountPaise || 0,
                discountPercent: item.discountPercent || null,
                hsnCode: item.hsnCode, // Required
                ean: item.ean || null,
                gstType: item.gstType || "EXCLUSIVE",
                batchNumber: batchUse?.batchCode || null,
                expiryDate: batchUse?.expiryDate || null,
                taxablePaise: taxCalc.taxableValuePaise,
                gstRateBps: Math.round((item.gstRate || 12) * 100),
                cgstPaise: taxCalc.cgstPaise,
                sgstPaise: taxCalc.sgstPaise,
                igstPaise: taxCalc.igstPaise,
              };
            }),
          },
        },
        include: { lineItems: true, sellerGstin: true },
      });

      // Create payments
      const paymentRecords = await Promise.all(
        payments.map((payment: any) =>
          tx.payment.create({
            data: {
              invoiceId: inv.id,
              method: payment.method,
              amountPaise: payment.amountPaise,
              status: payment.method === "CASH" ? "PAID" : "PENDING",
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

      // Update invoice payment status
      const totalPaid = paymentRecords
        .filter((p) => p.status === "PAID")
        .reduce((sum, p) => sum + p.amountPaise, 0);

      await tx.invoice.update({
        where: { id: inv.id },
        data: {
          paymentStatus: totalPaid >= finalTotal ? "PAID" : totalPaid > 0 ? "PARTIALLY_PAID" : "UNPAID",
          paidAmountPaise: totalPaid,
          paymentMethod: payments.length === 1 ? payments[0].method : "SPLIT",
        },
      });

      // Update prescription lines if linked
      if (prescription) {
        // Mark prescription lines as dispensed (simplified - match by drug name)
        // In production, use drugLibraryId matching
        await tx.prescriptionLine.updateMany({
          where: {
            prescriptionId: prescription.id,
            status: "PENDING",
          },
          data: {
            status: "DISPENSED",
            dispensedAt: new Date(),
          },
        });
      }

      // Handle loyalty points
      let loyaltyPointsEarned = 0;
      let loyaltyPointsRedeemed = 0;

      if (customer?.loyaltyAccount) {
        // Earn points (1 point per ₹1)
        const pointsToEarn = Math.floor(finalTotal / 100);
        if (pointsToEarn > 0) {
          await tx.loyaltyAccount.update({
            where: { id: customer.loyaltyAccount.id },
            data: { pointsBalance: { increment: pointsToEarn } },
          });

          await tx.loyaltyTransaction.create({
            data: {
              loyaltyAccountId: customer.loyaltyAccount.id,
              invoiceId: inv.id,
              type: "EARNED",
              points: pointsToEarn,
              description: `Points earned for invoice #${inv.id}`,
            },
          });

          loyaltyPointsEarned = pointsToEarn;
        }

        // Redeem points if requested (check payments for points redemption)
        // This would be handled in a separate redemption flow
      }

      return { invoice: inv, payments: paymentRecords, loyaltyPointsEarned, loyaltyPointsRedeemed };
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: DEMO_TENANT_ID,
        action: "INVOICE_CREATED",
        entity: "Invoice",
        entityId: invoice.invoice.id,
        afterJson: JSON.stringify({
          invoiceId: invoice.invoice.id,
          customerId,
          totalPaise: finalTotal,
        }),
      },
    });

    // POS audit log
    await logPosAction("POS_CHECKOUT", userId, DEMO_TENANT_ID, null, {
      invoiceId: invoice.invoice.id,
      customerId,
      totalPaise: finalTotal,
      itemCount: lineItems.length,
    });

    // Log Schedule H drug sales (if any)
    if (scheduleHValidation.warnings.length > 0 || scheduleHValidation.errors.length === 0 && lineItems.some((item: any) => item.schedule)) {
      // Find Schedule H items in line items
      const scheduleHItems: Array<{
        productId?: number;
        drugLibraryId?: number;
        productName: string;
        quantity: number;
        schedule: string;
      }> = [];

      for (const item of lineItems) {
        if (item.productId) {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
          });
          if (product?.schedule?.toUpperCase().startsWith("H")) {
            scheduleHItems.push({
              productId: product.id,
              productName: item.productName,
              quantity: item.quantity,
              schedule: product.schedule.toUpperCase(),
            });
          }
        } else if (item.drugLibraryId) {
          const drugLibrary = await prisma.drugLibrary.findUnique({
            where: { id: item.drugLibraryId },
          });
          if (drugLibrary?.isScheduleDrug || drugLibrary?.schedule?.toUpperCase().startsWith("H")) {
            scheduleHItems.push({
              drugLibraryId: drugLibrary.id,
              productName: item.productName,
              quantity: item.quantity,
              schedule: drugLibrary.schedule?.toUpperCase() || "H",
            });
          }
        }
      }

      if (scheduleHItems.length > 0) {
        await logScheduleHSale({
          invoiceId: invoice.invoice.id,
          prescriptionId: prescriptionId ? Number(prescriptionId) : 0,
          customerId: customerId ? Number(customerId) : 0,
          scheduleHItems,
          dispensedBy: userId,
          overrideBy: !scheduleHValidation.isValid && await canOverrideScheduleH(userId, role) ? userId : undefined,
          overrideReason: !scheduleHValidation.isValid ? "Validation override by authorized user" : undefined,
        });
      }
    }

    return NextResponse.json({
      invoice: invoice.invoice,
      payments: invoice.payments,
      loyaltyPointsEarned: invoice.loyaltyPointsEarned,
      loyaltyPointsRedeemed: invoice.loyaltyPointsRedeemed,
    });
  } catch (error: any) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: error.message || "Checkout failed" },
      { status: 500 }
    );
  }
}
