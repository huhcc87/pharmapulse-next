// src/app/api/products/[id]/gst/route.ts
// Update product GST metadata (HSN, GST rate, GST type, EAN)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { hsnCode, gstRate, gstType, barcode, gstOverride } = body;

    // Normalize inputs
    const normalizedHsnCode = hsnCode ? hsnCode.trim() : null;
    const normalizedBarcode = barcode ? barcode.trim() : null;
    const override = gstOverride === true;

    // Validation
    if (!normalizedHsnCode) {
      return NextResponse.json(
        { ok: false, error: "HSN code is required" },
        { status: 400 }
      );
    }

    // Validate HSN code format (4-8 digits)
    if (!/^\d{4,8}$/.test(normalizedHsnCode)) {
      return NextResponse.json(
        { ok: false, error: "HSN code must be 4-8 digits" },
        { status: 400 }
      );
    }

    // Find product
    const product = await prisma.product.findUnique({
      where: { id: Number(id) },
    });

    if (!product) {
      return NextResponse.json(
        { ok: false, error: "Product not found" },
        { status: 404 }
      );
    }

    // Fetch HSNMaster to derive GST if not overriding
    let derivedGstRate: number | null = null;
    let derivedGstType: string = "EXCLUSIVE";

    if (!override) {
      const hsnMaster = await prisma.hSNMaster.findUnique({
        where: { hsnCode: normalizedHsnCode },
      });

      if (!hsnMaster || !hsnMaster.isActive) {
        return NextResponse.json(
          {
            ok: false,
            error: `HSN code ${normalizedHsnCode} not found or inactive in HSN Master. Please add it to HSN Master first or enable override.`,
          },
          { status: 400 }
        );
      }

      derivedGstRate = hsnMaster.defaultGstRate ? Number(hsnMaster.defaultGstRate) : null;
      derivedGstType = hsnMaster.gstType;
    } else {
      // Override mode: validate provided values
      if (gstRate === undefined || gstRate === null) {
        return NextResponse.json(
          { ok: false, error: "GST rate is required when override is enabled" },
          { status: 400 }
        );
      }

      // Validate GST rate (allowed: 0, 5, 12, 18, 28)
      const allowedGstRates = [0, 5, 12, 18, 28];
      const gstRateNum = Number(gstRate);
      if (!allowedGstRates.includes(gstRateNum)) {
        return NextResponse.json(
          { ok: false, error: "GST rate must be one of: 0, 5, 12, 18, 28" },
          { status: 400 }
        );
      }

      // Validate GST type
      if (!gstType || !["INCLUSIVE", "EXCLUSIVE"].includes(gstType)) {
        return NextResponse.json(
          { ok: false, error: "GST type must be INCLUSIVE or EXCLUSIVE" },
          { status: 400 }
        );
      }

      derivedGstRate = gstRateNum;
      derivedGstType = gstType;
    }

    // Validate barcode uniqueness if provided
    if (normalizedBarcode) {
      const existingProduct = await prisma.product.findFirst({
        where: {
          id: { not: Number(id) },
          OR: [
            { barcode: normalizedBarcode },
            { barcodeValue: normalizedBarcode },
            // Also check new schema format
            ...(normalizedBarcode.length >= 8
              ? [
                  {
                    barcodeTypeEnum: { in: ["EAN13", "EAN8", "UPCA"] as any }, // UPCA instead of UPC
                    barcodeValue: normalizedBarcode,
                  },
                ]
              : []),
          ],
        },
      });

      if (existingProduct) {
        return NextResponse.json(
          { ok: false, error: `Barcode already assigned to product: ${existingProduct.name}` },
          { status: 400 }
        );
      }
    }

    // Update product GST metadata
    // NEVER reference taxInclusion - use only gstType
    let updateData: any = {
      hsnCode: normalizedHsnCode,
      gstRate: derivedGstRate,
      gstType: derivedGstType,
      gstOverride: override,
    };

    // Only update barcode if provided (don't clear existing barcode if not provided)
    if (normalizedBarcode !== null) {
      // Try new schema first, fallback to legacy
      updateData.barcode = normalizedBarcode;
      updateData.barcodeValue = normalizedBarcode;
      // Determine barcode type
      if (normalizedBarcode.length === 13) {
        updateData.barcodeTypeEnum = "EAN13";
      } else if (normalizedBarcode.length === 8) {
        updateData.barcodeTypeEnum = "EAN8";
      } else if (normalizedBarcode.length === 12) {
        updateData.barcodeTypeEnum = "UPC";
      } else {
        updateData.barcodeTypeEnum = "CODE128";
      }
    }

    const updated = await prisma.product.update({
      where: { id: Number(id) },
      data: updateData,
    });

    // Audit log with before/after comparison
    const oldValues = {
      hsnCode: product.hsnCode,
      gstRate: product.gstRate ? Number(product.gstRate) : null,
      gstType: product.gstType || "EXCLUSIVE",
      barcode: product.barcode || product.barcodeValue || null,
    };
    
    const newValues = {
      hsnCode: normalizedHsnCode,
      gstRate: derivedGstRate,
      gstType: derivedGstType,
      barcode: normalizedBarcode !== null ? normalizedBarcode : oldValues.barcode,
    };

    await prisma.auditLog.create({
      data: {
        tenantId: 1, // DEMO_TENANT_ID
        action: "PRODUCT_GST_UPDATED",
        entity: "Product",
        entityId: product.id,
        beforeJson: JSON.stringify(oldValues),
        afterJson: JSON.stringify(newValues),
        // description field doesn't exist in AuditLog model - removed
      // Description is logged in notes field if it exists
      },
    });

    return NextResponse.json({
      ok: true,
      product: {
        id: updated.id,
        name: updated.name,
        hsnCode: updated.hsnCode,
        gstRate: updated.gstRate ? Number(updated.gstRate) : null,
        gstType: updated.gstType || "EXCLUSIVE",
        barcode: updated.barcode,
        salePrice: updated.salePrice,
        unitPrice: updated.unitPrice,
        mrp: updated.mrp,
      },
    });
  } catch (error: any) {
    console.error("Product GST update error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to update product GST" },
      { status: 500 }
    );
  }
}

