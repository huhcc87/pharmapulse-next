/**
 * Enhanced Product Lookup by Barcode
 * Auto-populates product details with high confidence from Drug Library
 * Returns complete details including manufacturer, category, description
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBarcode } from "@/lib/barcodes/validate";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const barcode = searchParams.get("barcode") || "";

    if (!barcode) {
      return NextResponse.json(
        { error: "Barcode parameter required" },
        { status: 400 }
      );
    }

    const v = validateBarcode(barcode);
    if (!v.ok) {
      return NextResponse.json(
        { error: v.error },
        { status: 400 }
      );
    }

    const normalized = v.normalized;

    // Step 1: Check internal Product table (100% confidence)
    const internalProduct = await prisma.product.findFirst({
      where: {
        OR: [
          { barcodeValue: normalized as any },
          { barcode: normalized },
          { internalCode: normalized },
        ],
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        category: true,
        manufacturer: true,
        composition: true,
        saltComposition: true,
        hsnCode: true,
        gstRate: true,
        gstType: true,
        schedule: true,
        description: true,
        mrp: true,
        salePrice: true,
        unitPrice: true,
      },
    });

    if (internalProduct) {
      return NextResponse.json({
        found: true,
        confidence: 100,
        details: {
          name: internalProduct.name,
          category: internalProduct.category || "General",
          manufacturer: internalProduct.manufacturer || null,
          composition: internalProduct.composition || internalProduct.saltComposition || null,
          saltComposition: internalProduct.saltComposition || internalProduct.composition || null,
          description: internalProduct.description || `${internalProduct.name} - Pharmaceutical product`,
          hsnCode: internalProduct.hsnCode || "30049099",
          gstRate: internalProduct.gstRate ? Number(internalProduct.gstRate) : 12,
          gstType: (internalProduct.gstType as "EXCLUSIVE" | "INCLUSIVE") || "EXCLUSIVE",
          schedule: internalProduct.schedule || "H",
          mrp: internalProduct.mrp ? Number(internalProduct.mrp) : null,
          unitPrice: internalProduct.salePrice ? Number(internalProduct.salePrice) : (internalProduct.unitPrice ? Number(internalProduct.unitPrice) : null),
        },
        source: "internal_product",
        verificationStatus: "pharmacist_verified",
      });
    }

    // Step 2: Search Drug Library (for EAN barcodes, try various patterns)
    if (normalized.length === 13 && normalized.startsWith('890')) {
      // Try searching drug library with barcode as query
      // Drug library doesn't have direct barcode field, so we search by brand/QR patterns
      const drugLibraryResults = await prisma.drugLibrary.findMany({
        where: {
          OR: [
            { qrCode: { contains: normalized.slice(-6), mode: "insensitive" } }, // Last 6 digits might match
            { brandName: { contains: normalized.slice(-6), mode: "insensitive" } },
          ],
        },
        take: 5,
        select: {
          id: true,
          brandName: true,
          manufacturer: true,
          fullComposition: true,
          salts: true,
          category: true,
          packSize: true,
          priceInr: true,
          dpcoCeilingPriceInr: true,
          gstPercent: true,
          schedule: true,
          qrCode: true,
        },
      });

      if (drugLibraryResults.length > 0) {
        const bestMatch = drugLibraryResults[0];
        
        // Calculate confidence based on data completeness
        const hasCompleteData = !!(bestMatch.brandName && bestMatch.manufacturer && (bestMatch.fullComposition || bestMatch.salts));
        const confidence = hasCompleteData ? 90 : 75;

        return NextResponse.json({
          found: true,
          confidence,
          details: {
            name: bestMatch.brandName || `Product ${normalized.slice(-6)}`,
            category: bestMatch.category || "General",
            manufacturer: bestMatch.manufacturer || null,
            composition: bestMatch.fullComposition || bestMatch.salts || null,
            saltComposition: bestMatch.salts || bestMatch.fullComposition || null,
            description: `${bestMatch.brandName || "Pharmaceutical product"} - ${bestMatch.fullComposition || bestMatch.salts || "Details to be verified"}`,
            hsnCode: "30049099",
            gstRate: bestMatch.gstPercent ? Number(bestMatch.gstPercent) : 12,
            gstType: "EXCLUSIVE",
            schedule: bestMatch.schedule || "H",
            packSize: bestMatch.packSize || null,
            mrp: bestMatch.dpcoCeilingPriceInr ? Number(bestMatch.dpcoCeilingPriceInr) : (bestMatch.priceInr ? parseFloat(String(bestMatch.priceInr)) : null),
            unitPrice: bestMatch.priceInr ? parseFloat(String(bestMatch.priceInr)) * 0.9 : null,
          },
          source: "drug_library",
          verificationStatus: "scanned_unverified",
          drugLibraryId: bestMatch.id,
        });
      }
    }

    // Step 3: Return placeholder with low confidence (requires manual entry)
    return NextResponse.json({
      found: false,
      confidence: 0,
      details: {
        name: `Product ${normalized.slice(-6)}`, // Placeholder
        category: "General",
        manufacturer: null,
        composition: null,
        saltComposition: null,
        description: "Pharmaceutical product - details to be verified",
        hsnCode: "30049099",
        gstRate: 12,
        gstType: "EXCLUSIVE",
        schedule: "H",
        mrp: null,
        unitPrice: null,
      },
      source: "manual",
      verificationStatus: "scanned_unverified",
    });
  } catch (error: any) {
    console.error("Enhanced lookup error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to lookup product" },
      { status: 500 }
    );
  }
}
