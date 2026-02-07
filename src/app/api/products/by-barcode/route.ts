// src/app/api/products/by-barcode/route.ts
import { NextResponse } from "next/server";
import { lookupProductByBarcode } from "@/lib/products/unified-lookup";

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

    // Use unified lookup service (supports EAN, HSN, and INMED)
    const result = await lookupProductByBarcode(code);

    if (!result.found) {
      return NextResponse.json(
        { found: false, error: result.error, barcodeType: result.barcodeType },
        { status: 200 }
      );
    }

    return NextResponse.json({
      found: true,
      product: result.product,
      barcodeType: result.barcodeType,
    }, { status: 200 });
  } catch (error: any) {
    console.error("by-barcode error:", error);
    return NextResponse.json(
      { found: false, error: error.message || "Server error" },
      { status: 500 }
    );
  }
}
