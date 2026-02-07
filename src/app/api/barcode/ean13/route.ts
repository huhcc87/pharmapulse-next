import bwipjs from "bwip-js";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ean = (searchParams.get("ean") || "").trim();

  if (!/^\d{13}$/.test(ean)) {
    return new Response("Invalid EAN-13 (must be 13 digits)", { status: 400 });
  }

  // Generate SVG (no PNG stored)
  const svg = bwipjs.toSVG({
    bcid: "ean13",
    text: ean,
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
}
