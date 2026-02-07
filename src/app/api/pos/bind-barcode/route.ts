import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBarcode } from "@/lib/barcodes/validate";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId, barcode, barcodeType } = body;

    if (!productId || !barcode) {
      return NextResponse.json(
        { error: "productId and barcode are required" },
        { status: 400 }
      );
    }

    const productIdNum = parseInt(String(productId));
    if (isNaN(productIdNum)) {
      return NextResponse.json(
        { error: "Invalid productId" },
        { status: 400 }
      );
    }

    // Validate barcode
    const forcedType = barcodeType === "EAN8" || barcodeType === "EAN13" || barcodeType === "UPCA" ? barcodeType : undefined;
    const v = validateBarcode(barcode, forcedType);
    if (!v.ok) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productIdNum },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // For INMED codes, use internalCode instead of barcodeTypeEnum
    if (v.type === "INMED") {
      // Check if INMED code is already assigned
      const existing = await prisma.product.findFirst({
        where: {
          internalCode: v.normalized,
          id: { not: productIdNum },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "INMED code already assigned to another product" },
          { status: 409 }
        );
      }

      // Update product with internalCode for INMED
      const updated = await prisma.product.update({
        where: { id: productIdNum },
        data: {
          internalCode: v.normalized,
        },
        select: {
          id: true,
          name: true,
          barcodeValue: true,
          barcodeTypeEnum: true,
          internalCode: true,
        },
      });

      return NextResponse.json({
        ok: true,
        product: {
          id: String(updated.id),
          name: updated.name,
          barcode: updated.internalCode,
          barcodeType: "INMED",
          internalCode: updated.internalCode,
        },
      });
    }

    // For EAN/UPC codes, use barcodeTypeEnum and barcodeValue
    // Check if barcode is already assigned to another product
    const existing = await (prisma.product as any).findFirst({
      where: {
        barcodeTypeEnum: v.type,
        barcodeValue: v.normalized,
        id: { not: productIdNum },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Barcode already assigned to another product" },
        { status: 409 }
      );
    }

    // Update product with barcode and barcodeType
    const updated = await (prisma.product as any).update({
      where: { id: productIdNum },
      data: {
        barcodeValue: v.normalized,
        barcodeTypeEnum: v.type,
        barcodeSource: "manual",
        barcodeVerified: false,
      },
      select: {
        id: true,
        name: true,
        barcodeValue: true,
        barcodeTypeEnum: true,
        internalCode: true,
      },
    });

    return NextResponse.json({
      ok: true,
      product: {
        id: String(updated.id),
        name: updated.name,
        barcode: updated.barcodeValue,
        barcodeType: updated.barcodeTypeEnum,
        internalCode: updated.internalCode,
      },
    });
  } catch (error: any) {
    console.error("Bind barcode error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to bind barcode" },
      { status: 500 }
    );
  }
}
