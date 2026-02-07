import { validateBarcode } from "@/lib/barcodes/validate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      sku,
      barcode,
      category,
      unitPrice,
      mrp,
      salePrice,
      stockLevel = 0,
      minStock = 0,
      manufacturer,
      composition,
      saltComposition,
      hsnCode,
      gstRate,
      gstType = "EXCLUSIVE",
      schedule,
      description,
    } = body;

    // Validate required fields
    if (!name || !sku) {
      return NextResponse.json(
        { error: "Product name and SKU are required" },
        { status: 400 }
      );
    }

    // Validate barcode if provided
    let barcodeData: { type?: string; value?: string; normalized?: string } = {};
    if (barcode) {
      const v = validateBarcode(barcode);
      if (!v.ok) {
        return NextResponse.json(
          { error: `Invalid barcode: ${v.error}` },
          { status: 400 }
        );
      }
      barcodeData = {
        type: v.type,
        value: v.normalized,
        normalized: v.normalized,
      };
    }

    // Check if SKU already exists
    const existingBySku = await prisma.product.findUnique({
      where: { sku },
    });
    if (existingBySku) {
      return NextResponse.json(
        { error: `Product with SKU "${sku}" already exists` },
        { status: 409 }
      );
    }

    // Check if barcode is already assigned
    if (barcodeData.value) {
      const isInmed = barcodeData.type === "INMED";
      const existingByBarcode = await prisma.product.findFirst({
        where: isInmed
          ? { internalCode: barcodeData.value }
          : {
              OR: [
                { barcode: barcodeData.value }, // legacy field
                { barcodeValue: barcodeData.value as any, barcodeTypeEnum: barcodeData.type as any }, // new fields
              ],
            },
      });

      if (existingByBarcode) {
        return NextResponse.json(
          { error: `Barcode "${barcode}" is already assigned to product "${existingByBarcode.name}"` },
          { status: 409 }
        );
      }
    }

    // Create product with barcode in both old and new fields
    const createData: any = {
      name,
      sku,
      category: category || "General",
      unitPrice: Number(unitPrice) || 0,
      salePrice: salePrice != null ? Number(salePrice) : unitPrice ? Number(unitPrice) : null,
      mrp: mrp != null ? Number(mrp) : null,
      stockLevel: Number(stockLevel) || 0,
      minStock: Number(minStock) || 0,
      manufacturer: manufacturer || null,
      composition: composition || null,
      saltComposition: saltComposition || null,
      hsnCode: hsnCode || null,
      gstRate: gstRate != null ? Number(gstRate) : null,
      gstType: gstType || "EXCLUSIVE",
      schedule: schedule || null,
      description: description || null,
      isActive: true,
    };

    // Add barcode fields
    if (barcodeData.value) {
      if (barcodeData.type === "INMED") {
        createData.internalCode = barcodeData.value;
      } else {
        // Legacy field
        createData.barcode = barcodeData.value;
        createData.barcodeType = barcodeData.type?.toLowerCase() || "ean13";
        
        // New fields (if columns exist)
        try {
          createData.barcodeValue = barcodeData.value;
          createData.barcodeTypeEnum = barcodeData.type;
          createData.barcodeSource = "manual";
          createData.barcodeVerified = true;
        } catch (e) {
          // Columns might not exist, continue with legacy fields only
        }
      }
    }

    const product = await prisma.product.create({
      data: createData,
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        barcodeValue: true,
        barcodeTypeEnum: true,
        internalCode: true,
        category: true,
        unitPrice: true,
        salePrice: true,
        mrp: true,
        stockLevel: true,
        minStock: true,
        manufacturer: true,
        hsnCode: true,
        gstRate: true,
        gstType: true,
      },
    });

    return NextResponse.json({
      id: product.id,
      productName: product.name,
      sku: product.sku,
      barcode: product.barcodeValue || product.barcode || product.internalCode,
      category: product.category,
      unitPrice: product.unitPrice,
      salePrice: product.salePrice,
      mrp: product.mrp,
      stockLevel: product.stockLevel,
      minStock: product.minStock,
      manufacturer: product.manufacturer,
      hsnCode: product.hsnCode,
      gstRate: product.gstRate != null ? Number(product.gstRate) : null,
      gstType: product.gstType,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating product:", error);
    
    // Handle unique constraint violations
    if (error.code === "P2002") {
      const field = error.meta?.target?.[0] || "field";
      return NextResponse.json(
        { error: `Product with this ${field} already exists` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create product" },
      { status: 500 }
    );
  }
}
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("barcode") || searchParams.get("code") || "";

    if (!code) {
      return NextResponse.json(
        { found: false, error: "barcode or code parameter required" },
        { status: 200 }
      );
    }

    const v = validateBarcode(code);

    if (!v.ok) {
      return NextResponse.json({ found: false, error: v.error }, { status: 200 });
    }

    // narrow type for TS (useful if you later branch logic)
    const isInmed = v.type === "INMED";

    // For INMED we keep alphanumeric; for EAN/UPC it's digits (already normalized)
    const normalizedValue = v.normalized;

    // 1) Try "new" fields first (barcodeTypeEnum + barcodeValue)
    //    BUT: your DB currently throws "Product.barcode_value does not exist"
    //    so we catch and fallback to legacy fields.
    let product: any = null;

    try {
      product = await prisma.product.findFirst({
        where: {
          barcodeTypeEnum: v.type === "INMED" ? undefined : (v.type as any), // INMED uses internalCode
          barcodeValue: normalizedValue,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          barcodeValue: true,
          barcodeTypeEnum: true,
          internalCode: true,
          hsnCode: true,
          gstRate: true,
          gstType: true,
          salePrice: true,
          unitPrice: true,
          mrp: true,
          category: true,
          manufacturer: true,
          stockLevel: true,
          minStock: true,
        },
      });
    } catch (e: any) {
      // Most likely: column barcode_value doesn't exist in DB yet.
      // We will fallback to legacy fields below.
      product = null;
    }

    // 2) Legacy fallback (works with current DB)
    if (!product) {
      // If INMED, this is typically stored in internalCode.
      // If EAN/UPC, this is stored in barcode (legacy).
      product = await prisma.product.findFirst({
        where: {
          OR: [
            { barcode: normalizedValue }, // legacy barcode
            { internalCode: normalizedValue }, // INMED or internal SKU
          ],
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          // these may or may not exist depending on your schema; keep only safe selects
          internalCode: true,
          hsnCode: true,
          gstRate: true,
          gstType: true,
          salePrice: true,
          unitPrice: true,
          mrp: true,
          category: true,
          manufacturer: true,
          stockLevel: true,
          minStock: true,

          // if your Prisma schema still has these, selecting them is fine;
          // if not, remove them from select.
          barcode: true,
        },
      });
    }

    if (!product) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    // choose a returned barcode value safely
    const returnedBarcode =
      // @ts-ignore
      product.barcodeValue || product.barcode || product.internalCode || (isInmed ? normalizedValue : normalizedValue);

    return NextResponse.json({
      found: true,
      product: {
        id: String(product.id),
        name: product.name,
        barcode: returnedBarcode,
        internalCode: product.internalCode ?? null,
        hsn: product.hsnCode ?? null,
        gstRate: product.gstRate != null ? Number(product.gstRate) : null,
        gstType: (product.gstType as "EXCLUSIVE" | "INCLUSIVE") || "EXCLUSIVE",
        salePrice: Number(product.salePrice ?? product.unitPrice ?? 0),
        mrp: product.mrp != null ? Number(product.mrp) : null,
        category: product.category ?? null,
        manufacturer: product.manufacturer ?? null,
        stockLevel: product.stockLevel ?? 0,
        minStock: product.minStock ?? 0,
      },
    });
  } catch (error: any) {
    console.error("Error in /api/pos/product:", error);
    return NextResponse.json(
      { found: false, error: error?.message || "Internal server error" },
      { status: 200 }
    );
  }
}
