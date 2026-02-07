import bwipjs from "bwip-js";
import { validateBarcode } from "@/lib/barcodes/validate";

export const runtime = "nodejs"; // Required for bwip-js

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const codeParam = (searchParams.get("code") || "").trim();
    const typeParam = (searchParams.get("type") || "").toUpperCase() as any;

    if (!codeParam) {
      return new Response("code parameter is required", { status: 400 });
    }

    const forcedType =
      typeParam === "EAN8" || typeParam === "EAN13" || typeParam === "UPCA" ? typeParam : undefined;

    const v = validateBarcode(codeParam, forcedType);

    if (!v.ok) {
      return new Response(v.error, { status: 400 });
    }

    const bcid = v.type.toLowerCase(); // "ean8" | "ean13" | "upca"

    try {
      const svg = bwipjs.toSVG({
        bcid,
        text: v.normalized,
        includetext: true,
        textxalign: "center",
        scale: 2,
        height: 12,
      });

      return new Response(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch (error: any) {
      console.error("Barcode generation error:", error);
      return new Response(error?.message || "Barcode generation failed", { status: 500 });
    }
  } catch (error: any) {
    console.error("API route error:", error);
    return new Response(error?.message || "Internal server error", { status: 500 });
  }
}
