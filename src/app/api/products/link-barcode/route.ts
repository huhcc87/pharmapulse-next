import { prisma } from "@/lib/prisma";
import { validateBarcode } from "@/lib/barcodes/validate";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId, code, type, source } = body;

    if (!productId || !code) {
      return NextResponse.json(
        { error: "productId and code are required" },
        { status: 400 }
      );
    }

    const numericProductId = parseInt(String(productId));
    if (isNaN(numericProductId)) {
      return NextResponse.json({ error: "Invalid productId" }, { status: 400 });
    }

    // Validate barcode
    const forcedType = type === "EAN8" || type === "EAN13" || type === "UPCA" ? type : undefined;
    const v = validateBarcode(code, forcedType);
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: numericProductId },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check if barcode is already assigned to another product
    const existing = await prisma.product.findFirst({
      where: {
              barcodeTypeEnum: v.type === "INMED" ? undefined : (v.type as any),
              barcodeValue: v.normalized as any,
        id: { not: numericProductId },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: `Barcode ${v.normalized} (${v.type}) is already assigned to product ID ${existing.id}`,
        },
        { status: 409 }
      );
    }

    // Update product with barcode (INMED uses internalCode, others use barcodeTypeEnum)
    const updated = await prisma.product.update({
      where: { id: numericProductId },
      data: v.type === "INMED"
        ? {
            internalCode: v.normalized,
            barcodeSource: source || "manual",
            barcodeVerified: false,
          }
        : {
            barcodeValue: v.normalized as any,
            barcodeTypeEnum: v.type as any,
            barcodeSource: source || "manual",
            barcodeVerified: false,
          },
      select: {
        id: true,
        name: true,
        barcodeValue: true,
        barcodeTypeEnum: true,
        barcodeSource: true,
        barcodeVerified: true,
      },
    });

    return NextResponse.json({ ok: true, product: updated });
  } catch (error: any) {
    console.error("Link barcode error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to link barcode" },
      { status: 500 }
    );
  }
}





