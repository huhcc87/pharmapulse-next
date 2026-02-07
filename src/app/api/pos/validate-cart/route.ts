import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { batchAutoMapHsn } from "@/lib/hsn/auto-map";
import { determineSupplyType } from "@/lib/gst/advanced";
import { getEffectiveGstRate } from "@/lib/gst/advanced";
import { selectBestBatch, getSuggestedDiscount, getExpiryWarning } from "@/lib/inventory/fefo";
import { getInventoryHealth } from "@/lib/inventory/stock-indicators";
import { normalizeLineItem, validateCartForInvoice, filterBlockingIssues } from "@/lib/cart/validation";

const DEMO_TENANT_ID = 1;

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { lineItems, customerId } = body;

    if (!lineItems || lineItems.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Get seller GSTIN - auto-create if missing
    let sellerGstin = await prisma.orgGstin.findFirst({
      where: { isActive: true },
      include: { org: true },
    });

    if (!sellerGstin) {
      // Auto-create default org and GSTIN
      let org = await prisma.org.findFirst({
        where: { tenantId: 1 },
      });

      if (!org) {
        org = await prisma.org.create({
          data: {
            tenantId: 1,
            name: "Demo Pharmacy",
            role: "RETAILER",
            stateCode: "27", // Maharashtra
          },
        });
      }

      sellerGstin = await prisma.orgGstin.create({
        data: {
          orgId: org.id,
          gstin: "27AAAAA0000A1Z5", // Demo GSTIN
          stateCode: "27", // Maharashtra
          legalName: "Demo Pharmacy",
          isActive: true,
          invoicePrefix: "INV",
          nextInvoiceNo: 1,
        },
        include: { org: true },
      });
    }

    // Get customer if provided
    const customer = customerId
      ? await prisma.customer.findUnique({ where: { id: Number(customerId) } })
      : null;

    // Determine supply type
    const supplyType = determineSupplyType({
      sellerStateCode: sellerGstin.stateCode,
      buyerStateCode: customer?.stateCode || customer?.billingStateCode || null,
      placeOfSupplyPolicy: (sellerGstin.org.placeOfSupplyPolicy as "CUSTOMER_STATE" | "STORE_STATE" | undefined) || "CUSTOMER_STATE",
    });

    const issues: Array<{
      type: "MISSING_HSN" | "MISSING_BATCH" | "LOW_STOCK" | "OUT_OF_STOCK" | "INSUFFICIENT_STOCK" | "EXPIRED_BATCH" | "EXPIRY_WARNING" | "INVALID_GST";
      itemKey: string;
      productName: string;
      message: string;
      suggestion?: any;
    }> = [];

    const warnings: Array<{
      type: "STOCK_WARNING" | "EXPIRY_WARNING";
      itemKey: string;
      productName: string;
      message: string;
    }> = [];

    // Validate each line item
    const validatedItems = await Promise.all(
      lineItems.map(async (item: any) => {
        let product = null;
        let drugLibrary = null;
        let batch = null;

        if (item.productId) {
          product = await prisma.product.findUnique({
            where: { id: item.productId },
            include: { batches: { where: { quantityOnHand: { gt: 0 } }, orderBy: { expiryDate: "asc" } } },
          });

          if (item.batchId) {
            batch = await prisma.batch.findUnique({ where: { id: item.batchId } });
          }
        } else if (item.drugLibraryId) {
          drugLibrary = await prisma.drugLibrary.findUnique({ where: { id: item.drugLibraryId } });
        }

        // Check HSN - use item.hsnCode if provided, otherwise try to get from product/drug
        let effectiveHsn = item.hsnCode || null;
        
        // If HSN is provided in cart item, use it directly
        if (effectiveHsn && effectiveHsn.trim()) {
          // HSN is already in cart item, validate it
          const effective = await getEffectiveGstRate({
            productId: item.productId,
            drugLibraryId: item.drugLibraryId,
            batchId: item.batchId,
            hsnCode: effectiveHsn,
            gstRate: item.gstRate,
            pricePaise: item.unitPricePaise || 0,
            quantity: item.quantity || 1,
          });
          
          // If effective HSN is still null, use the one from cart
          if (!effective.hsnCode && effectiveHsn) {
            effective.hsnCode = effectiveHsn;
          }
        } else {
          // Try to get HSN from product/drug library
          const effective = await getEffectiveGstRate({
            productId: item.productId,
            drugLibraryId: item.drugLibraryId,
            batchId: item.batchId,
            hsnCode: null,
            gstRate: item.gstRate,
            pricePaise: item.unitPricePaise || 0,
            quantity: item.quantity || 1,
          });
          
          effectiveHsn = effective.hsnCode;
        }

        // If still no HSN, try auto-mapping
        if (!effectiveHsn || !effectiveHsn.trim()) {
          const suggestion = await batchAutoMapHsn([
            {
              productId: item.productId,
              drugLibraryId: item.drugLibraryId,
              productName: item.productName,
              category: product?.category || null,
              saltComposition: product?.saltComposition || drugLibrary?.salts || null,
              brandName: drugLibrary?.brandName || null,
            },
          ]).then((map) => map.get(item.productId || item.drugLibraryId || 0));

          if (suggestion) {
            // Use suggested HSN
            effectiveHsn = suggestion.hsnCode;
          } else {
            // Default HSN for medicines
            effectiveHsn = "3004";
          }
        }

        // Check batch if required - only for products with batch tracking
        let selectedBatch = batch;
        if (item.productId && product) {
          // Only require batch if product has batches AND batch tracking is enabled
          const hasBatches = product.batches && product.batches.length > 0;
          if (hasBatches) {
            if (!item.batchId) {
              // Auto-select best batch (FEFO) - don't block, just suggest
              const bestBatch = await selectBestBatch(
                item.productId,
                undefined,
                item.quantity,
                DEMO_TENANT_ID,
                null
              );

              if (!bestBatch) {
                // Only block if truly out of stock
                issues.push({
                  type: "OUT_OF_STOCK",
                  itemKey: item.key,
                  productName: item.productName,
                  message: `Out of stock for ${item.productName}`,
                });
              }
              // Don't add MISSING_BATCH issue - allow checkout without batch selection
              // The system will auto-select best batch during invoice creation
            } else {
              // Validate selected batch
              selectedBatch = await prisma.batch.findUnique({
                where: { id: item.batchId },
              });

              if (!selectedBatch || selectedBatch.quantityOnHand < item.quantity) {
                issues.push({
                  type: "INSUFFICIENT_STOCK",
                  itemKey: item.key,
                  productName: item.productName,
                  message: `Insufficient stock in selected batch. Available: ${selectedBatch?.quantityOnHand || 0}, Required: ${item.quantity}`,
                });
              }

              // Check expiry
              if (selectedBatch) {
                const expiryWarning = getExpiryWarning(selectedBatch.expiryDate);
                if (expiryWarning.level === "EXPIRED") {
                  issues.push({
                    type: "EXPIRED_BATCH",
                    itemKey: item.key,
                    productName: item.productName,
                    message: `Selected batch ${selectedBatch.batchCode} is expired`,
                  });
                } else if (expiryWarning.level === "CRITICAL") {
                  warnings.push({
                    type: "EXPIRY_WARNING",
                    itemKey: item.key,
                    productName: item.productName,
                    message: `Critical: Batch ${selectedBatch.batchCode} expiring in ${expiryWarning.days} days`,
                  });
                } else if (expiryWarning.level === "SOON" || expiryWarning.level === "NEAR") {
                  warnings.push({
                    type: "EXPIRY_WARNING",
                    itemKey: item.key,
                    productName: item.productName,
                    message: `Warning: Batch ${selectedBatch.batchCode} expiring in ${expiryWarning.days} days`,
                  });
                }
              }
            }
          }
        } else if (item.drugLibraryId) {
          // For drug library items, check inventory with batch tracking
          const inventoryItem = await prisma.inventoryItem.findFirst({
            where: {
              drugLibraryId: item.drugLibraryId,
              tenantId: DEMO_TENANT_ID,
              qtyOnHand: { gte: item.quantity },
            },
            include: { batch: true },
            orderBy: { expiryDate: "asc" }, // FEFO
          });

          if (!inventoryItem) {
            issues.push({
              type: "OUT_OF_STOCK",
              itemKey: item.key,
              productName: item.productName,
              message: `Insufficient stock for ${item.productName}`,
            });
          } else if (inventoryItem.batch) {
            const expiryWarning = getExpiryWarning(inventoryItem.batch.expiryDate);
            if (expiryWarning.level === "EXPIRED") {
              issues.push({
                type: "EXPIRED_BATCH",
                itemKey: item.key,
                productName: item.productName,
                message: `Batch ${inventoryItem.batchCode} is expired`,
              });
            } else if (expiryWarning.level !== "SAFE") {
              warnings.push({
                type: "EXPIRY_WARNING",
                itemKey: item.key,
                productName: item.productName,
                message: expiryWarning.message,
              });
            }
          }
        }

        // Check stock with health indicators
        if (product) {
          const availableStock = selectedBatch
            ? selectedBatch.quantityOnHand
            : product.batches.reduce((sum: number, b: any) => sum + b.quantityOnHand, 0);

          const health = getInventoryHealth(
            availableStock,
            selectedBatch?.expiryDate || null,
            5 // Default low stock threshold
          );

          if (availableStock < item.quantity) {
            issues.push({
              type: "LOW_STOCK",
              itemKey: item.key,
              productName: item.productName,
              message: `Insufficient stock. Available: ${availableStock}, Required: ${item.quantity}`,
            });
          } else if (health.stock.status === "LOW_STOCK") {
            warnings.push({
              type: "STOCK_WARNING",
              itemKey: item.key,
              productName: item.productName,
              message: `Low stock warning. Only ${availableStock} available`,
            });
          }
        }

        // Get final effective GST rate with validated HSN
        const finalEffective = await getEffectiveGstRate({
          productId: item.productId,
          drugLibraryId: item.drugLibraryId,
          batchId: item.batchId,
          hsnCode: effectiveHsn,
          gstRate: item.gstRate || item.gstRateBps ? (item.gstRateBps / 100) : 12, // Default to 12% if missing
          pricePaise: item.unitPricePaise || 0,
          quantity: item.quantity || 1,
        });

        // Ensure validatedGstRate is always a valid number
        const validatedGstRate = finalEffective.gstRate != null && !isNaN(finalEffective.gstRate) && finalEffective.gstRate > 0
          ? finalEffective.gstRate
          : (item.gstRate != null && !isNaN(item.gstRate) ? item.gstRate : (item.gstRateBps ? item.gstRateBps / 100 : 12));

        return {
          ...item,
          validatedHsnCode: effectiveHsn || finalEffective.hsnCode || "3004",
          validatedGstRate: validatedGstRate,
          validatedGstType: finalEffective.gstType || item.gstType || "EXCLUSIVE",
        };
      })
    );

    // Normalize all items before computing GST (ensures gstRate is always valid)
    const normalizedItems = validatedItems.map(item => {
      const normalized = normalizeLineItem(item);
      if (!normalized) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Line missing GST - normalization failed", item);
        }
        // Return a safe default
        return {
          ...item,
          validatedGstRate: item.validatedGstRate || 12,
          validatedHsnCode: item.validatedHsnCode || "3004",
          validatedGstType: item.validatedGstType || "EXCLUSIVE",
        };
      }
      // Use normalized values
      return {
        ...item,
        validatedGstRate: normalized.gstRate,
        validatedHsnCode: normalized.hsnCode || item.validatedHsnCode || "3004",
        validatedGstType: normalized.gstType,
      };
    });

    // Compute totals with normalized items
    const { computeLineItemGst } = await import("@/lib/gst/advanced");
    const lineCalculations = await Promise.all(
      normalizedItems.map((item) => {
        // Ensure gstRate is always a valid number
        const safeGstRate = item.validatedGstRate != null && !isNaN(item.validatedGstRate) && item.validatedGstRate >= 0
          ? item.validatedGstRate
          : 12;

        return computeLineItemGst(
          {
            productId: item.productId,
            drugLibraryId: item.drugLibraryId,
            batchId: item.batchId,
            hsnCode: item.validatedHsnCode,
            gstRate: safeGstRate, // Always valid number
            gstType: item.validatedGstType || "EXCLUSIVE",
            pricePaise: item.unitPricePaise || 0,
            quantity: item.quantity || 1,
            discountPaise: item.discountPaise,
            discountPercent: item.discountPercent,
          },
          supplyType
        );
      })
    );

    const totals = lineCalculations.reduce(
      (acc, calc) => {
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

    // Round off
    const { roundOff } = await import("@/lib/gst/advanced");
    const roundOffPaise = roundOff(totals.grandTotalPaise);
    totals.grandTotalPaise += roundOffPaise;

    // Filter out non-blocking issues - only keep critical ones
    const blockingIssues = issues.filter((i) => {
      // MISSING_HSN is not blocking (we use default)
      if (i.type === "MISSING_HSN") {
        return false;
      }
      // MISSING_BATCH is not blocking (system auto-selects best batch)
      if (i.type === "MISSING_BATCH") {
        return false;
      }
      // LOW_STOCK is a warning, not blocking
      if (i.type === "LOW_STOCK") {
        return false;
      }
      // Only these are truly blocking
      return i.type === "OUT_OF_STOCK" || i.type === "EXPIRED_BATCH" || i.type === "INSUFFICIENT_STOCK";
    });

    // Only return blocking issues to the frontend
    const displayIssues = blockingIssues;

    // Ensure we always have valid totals even if validation fails
    const finalTotals = totals || {
      totalTaxablePaise: 0,
      totalCGSTPaise: 0,
      totalSGSTPaise: 0,
      totalIGSTPaise: 0,
      grandTotalPaise: 0,
      roundOffPaise: 0,
    };

    // Ensure all lineCalculations have valid gstRate and required fields (null-safe)
    const safeLineCalculations = (lineCalculations || []).map((calc: any, idx: number) => {
      // Ensure calc exists and is an object
      if (!calc || typeof calc !== 'object') {
        if (process.env.NODE_ENV === "development") {
          console.warn("Line calculation is null or invalid", { calc, idx });
        }
        // Return safe defaults
        return {
          gstRate: 12,
          hsnCode: "3004",
          cgstPaise: 0,
          sgstPaise: 0,
          igstPaise: 0,
          taxableValuePaise: 0,
          lineTotalPaise: 0,
        };
      }

      const originalItem = normalizedItems[idx];
      if (!originalItem) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Original item is null at index", idx, { calc });
        }
        // Return safe defaults from calc if available
        return {
          ...calc,
          gstRate: (calc.gstRate != null && !isNaN(calc.gstRate)) ? calc.gstRate : 12,
          hsnCode: calc.hsnCode || "3004",
          cgstPaise: calc.cgstPaise ?? 0,
          sgstPaise: calc.sgstPaise ?? 0,
          igstPaise: calc.igstPaise ?? 0,
          taxableValuePaise: calc.taxableValuePaise ?? 0,
          lineTotalPaise: calc.lineTotalPaise ?? 0,
        };
      }

      // Ensure calc has gstRate before normalizing
      const itemWithCalc = {
        ...originalItem,
        gstRate: (calc.gstRate != null && !isNaN(calc.gstRate)) 
          ? calc.gstRate 
          : (originalItem.validatedGstRate != null && !isNaN(originalItem.validatedGstRate))
            ? originalItem.validatedGstRate
            : (originalItem.gstRate != null && !isNaN(originalItem.gstRate) ? originalItem.gstRate : 12),
        ...calc,
      };

      const normalized = normalizeLineItem(itemWithCalc);
      
      if (!normalized || !normalized.gstRate || isNaN(normalized.gstRate)) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Line missing GST - calculation normalization failed", { calc, originalItem, normalized });
        }
        // Return safe defaults
        return {
          ...calc,
          gstRate: (calc.gstRate != null && !isNaN(calc.gstRate)) ? calc.gstRate : 12, // Always a valid number
          hsnCode: calc.hsnCode || originalItem.validatedHsnCode || "3004",
          cgstPaise: calc.cgstPaise ?? 0,
          sgstPaise: calc.sgstPaise ?? 0,
          igstPaise: calc.igstPaise ?? 0,
          taxableValuePaise: calc.taxableValuePaise ?? 0,
          lineTotalPaise: calc.lineTotalPaise ?? 0,
        };
      }

      // Use normalized values (gstRate is guaranteed to be a number)
      return {
        ...calc,
        gstRate: normalized.gstRate, // Always a valid number 0-100
        hsnCode: normalized.hsnCode || calc.hsnCode || originalItem.validatedHsnCode || "3004",
        cgstPaise: calc.cgstPaise ?? 0,
        sgstPaise: calc.sgstPaise ?? 0,
        igstPaise: calc.igstPaise ?? 0,
        taxableValuePaise: calc.taxableValuePaise ?? 0,
        lineTotalPaise: calc.lineTotalPaise ?? 0,
      };
    });

    return NextResponse.json({
      valid: blockingIssues.length === 0,
      issues: displayIssues, // Only show blocking issues
      warnings,
      supplyType: supplyType || "INTRA_STATE",
      totals: {
        ...finalTotals,
        roundOffPaise: (finalTotals as any).roundOffPaise || 0,
      },
      lineCalculations: safeLineCalculations,
    });
  } catch (error: any) {
    console.error("Cart validation error:", error);
    // Return a valid response structure even on error, but mark as invalid
    return NextResponse.json({
      valid: false,
      issues: [
        {
          type: "ERROR",
          itemKey: "system",
          productName: "System Error",
          message: error.message || "Validation failed. Please try again.",
        },
      ],
      warnings: [],
      supplyType: "INTRA_STATE",
      totals: {
        totalTaxablePaise: 0,
        totalCGSTPaise: 0,
        totalSGSTPaise: 0,
        totalIGSTPaise: 0,
        grandTotalPaise: 0,
        roundOffPaise: 0,
      },
      lineCalculations: [],
      error: error.message || "Validation failed",
    });
  }
}
