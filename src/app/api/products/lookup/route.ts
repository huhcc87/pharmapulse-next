// src/app/api/products/lookup/route.ts
// Barcode lookup endpoint for products

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveBarcode } from "@/lib/barcode/resolver";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const barcode = searchParams.get("barcode");

    if (!barcode || barcode.trim().length < 8) {
      return NextResponse.json(
        { found: false, error: "Barcode must be at least 8 characters" },
        { status: 400 }
      );
    }

    const normalizedBarcode = barcode.trim();

    // Use existing barcode resolver
    const result = await resolveBarcode(normalizedBarcode);

    if (result.found === "inventory" && result.product) {
      return NextResponse.json({
        found: true,
        product: {
          id: result.product.id,
          name: result.product.name,
          hsnCode: result.product.hsnCode,
          gstRate: result.product.gstRate,
          gstType: result.product.gstType || "EXCLUSIVE",
          barcode: result.product.barcode || result.product.barcodeValue,
          category: result.product.category,
          manufacturer: result.product.manufacturer,
        },
      });
    }

    if (result.found === "library" && result.drug) {
      return NextResponse.json({
        found: true,
        drug: result.drug,
        note: "Found in drug library but not yet in inventory",
      });
    }

    return NextResponse.json({
      found: false,
      message: "No product found with this barcode",
    });
  } catch (error: any) {
    console.error("Barcode lookup error:", error);
    return NextResponse.json(
      { found: false, error: error.message || "Failed to lookup barcode" },
      { status: 500 }
    );
  }
}
