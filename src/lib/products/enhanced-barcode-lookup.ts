/**
 * Enhanced Barcode Lookup Service
 * Auto-populates product details with high confidence from Drug Library
 * Supports EAN/HSN/INMED codes with verification system
 *
 * DROP-IN SAFE VERSION:
 * - Avoids Prisma type/build breaks when some fields/models don't exist yet.
 * - Uses runtime feature-detection via (prisma as any) and conservative selects.
 * - Still returns strong results when your schema includes the expected fields.
 */

import { prisma } from "@/lib/prisma";

export type VerificationStatus =
  | "scanned_unverified"
  | "pharmacist_verified"
  | "admin_verified";

export interface EnhancedProductDetails {
  name: string;
  category: string;
  description: string;
  manufacturer: string;
  composition: string;
  saltComposition?: string;
  hsnCode: string;
  gstRate: number;
  gstType: "EXCLUSIVE" | "INCLUSIVE";
  schedule?: string;
  packSize?: string;
  mrp?: number;
  unitPrice?: number;
  confidence: number; // 0-100
  verificationStatus: VerificationStatus;
  source: "drug_library" | "internal_product" | "ai_lookup" | "manual";
  sources?: string[];
}

function normalizeBarcode(input: string): string {
  return (input || "").trim().toUpperCase().replace(/\s+/g, "");
}

function isEAN13(code: string): boolean {
  return /^\d{13}$/.test(code);
}

function isLikelyIndianEAN(code: string): boolean {
  return isEAN13(code) && code.startsWith("890");
}

function safeNumber(v: any): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === "bigint" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function fallbackDetails(normalized: string): EnhancedProductDetails {
  return {
    name: `Product ${normalized.slice(-6) || normalized}`,
    category: "General",
    description: "Pharmaceutical product - details to be verified",
    manufacturer: "To be determined",
    composition: "Active ingredients as per formulation",
    hsnCode: "30049099",
    gstRate: 12,
    gstType: "EXCLUSIVE",
    confidence: 0,
    verificationStatus: "scanned_unverified",
    source: "manual",
    sources: [],
  };
}

/**
 * Enhanced barcode lookup with drug library integration
 */
export async function enhancedBarcodeLookup(
  barcode: string,
  tenantId: number = 1
): Promise<{
  found: boolean;
  details?: EnhancedProductDetails;
  error?: string;
}> {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) {
    return { found: false, error: "Empty barcode" };
  }

  try {
    const p = prisma as any;

    // -----------------------------
    // Step 1: Internal Product table (best source)
    // -----------------------------
    // We avoid strict field assumptions by:
    // - using (prisma as any)
    // - selecting only fields that usually exist
    // - tolerating missing optional fields
    let internalProduct: any = null;

    if (p?.product?.findFirst) {
      // Try common barcode fields across schemas.
      const orClauses: any[] = [
        { barcode: normalized },
        { internalCode: normalized },
        { barcodeValue: normalized },
        { ean: normalized },
        { gtin: normalized },
      ];

      // If your Product model has tenantId, this will work; if not, Prisma will throw.
      // So we try once with tenantId filter, then retry without it.
      try {
        internalProduct = await p.product.findFirst({
          where: {
            AND: [
              { OR: orClauses },
              { isActive: true },
              { tenantId },
            ],
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
      } catch {
        internalProduct = await p.product.findFirst({
          where: {
            AND: [{ OR: orClauses }, { isActive: true }],
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
      }
    }

    if (internalProduct) {
      const mrp = safeNumber(internalProduct.mrp);
      const salePrice = safeNumber(internalProduct.salePrice);
      const unitPrice = safeNumber(internalProduct.unitPrice);

      const details: EnhancedProductDetails = {
        name: internalProduct.name,
        category: internalProduct.category || "General",
        description:
          internalProduct.description ||
          `${internalProduct.name} - Pharmaceutical product`,
        manufacturer: internalProduct.manufacturer || "To be determined",
        composition:
          internalProduct.composition ||
          internalProduct.saltComposition ||
          "Active ingredients as per formulation",
        saltComposition:
          internalProduct.saltComposition || internalProduct.composition,
        hsnCode: internalProduct.hsnCode || "30049099",
        gstRate: safeNumber(internalProduct.gstRate) ?? 12,
        gstType: (internalProduct.gstType as "EXCLUSIVE" | "INCLUSIVE") || "EXCLUSIVE",
        schedule: internalProduct.schedule || "H",
        mrp: mrp ?? undefined,
        unitPrice: salePrice ?? unitPrice ?? undefined,
        confidence: 100,
        verificationStatus: "pharmacist_verified",
        source: "internal_product",
        sources: ["Internal Product Database"],
      };

      return { found: true, details };
    }

    // -----------------------------
    // Step 2: Drug Library search (best-effort)
    // -----------------------------
    let drugLibraryCandidates: any[] = [];

    if (p?.drugLibrary?.findMany) {
      // We try multiple possible fields because your DrugLibrary schema may differ.
      // Each attempt is wrapped to prevent build/runtime failure if a field doesn't exist.
      const last6 = normalized.slice(-6);

      const tries: Array<() => Promise<any[]>> = [
        () =>
          p.drugLibrary.findMany({
            where: {
              OR: [
                { qrCode: { contains: normalized, mode: "insensitive" } },
                { qrCode: { contains: last6, mode: "insensitive" } },
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
          }),
        () =>
          p.drugLibrary.findMany({
            where: {
              OR: [
                { brandName: { contains: last6, mode: "insensitive" } },
                { brandName: { contains: normalized, mode: "insensitive" } },
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
            },
          }),
      ];

      for (const attempt of tries) {
        try {
          const res = await attempt();
          if (Array.isArray(res) && res.length) {
            drugLibraryCandidates = res;
            break;
          }
        } catch {
          // ignore and try next pattern
        }
      }
    }

    // -----------------------------
    // Step 3: EAN heuristics (India prefix 890)
    // -----------------------------
    if (isLikelyIndianEAN(normalized) && drugLibraryCandidates.length > 0) {
      const best = drugLibraryCandidates[0];

      const mrp =
        safeNumber(best.dpcoCeilingPriceInr) ??
        safeNumber(best.priceInr) ??
        undefined;

      const baseUnit =
        safeNumber(best.priceInr) !== undefined
          ? (safeNumber(best.priceInr) as number) * 0.9
          : undefined;

      const details: EnhancedProductDetails = {
        name: best.brandName || `Product ${normalized.slice(-6)}`,
        category: best.category || "General",
        description: `${best.brandName || "Product"} - ${
          best.fullComposition || best.salts || "Pharmaceutical product"
        }`,
        manufacturer: best.manufacturer || "To be determined",
        composition:
          best.fullComposition || best.salts || "Active ingredients as per formulation",
        saltComposition: best.salts || best.fullComposition,
        hsnCode: "30049099",
        gstRate: safeNumber(best.gstPercent) ?? 12,
        gstType: "EXCLUSIVE",
        schedule: best.schedule || "H",
        packSize: best.packSize || undefined,
        mrp,
        unitPrice: baseUnit,
        confidence: 85,
        verificationStatus: "scanned_unverified",
        source: "drug_library",
        sources: ["Drug Library Database"],
      };

      return { found: true, details };
    }

    // If we found drug library candidates even without 890 EAN, still return a match with slightly lower confidence
    if (drugLibraryCandidates.length > 0) {
      const best = drugLibraryCandidates[0];

      const details: EnhancedProductDetails = {
        name: best.brandName || `Product ${normalized.slice(-6)}`,
        category: best.category || "General",
        description: `${best.brandName || "Product"} - ${
          best.fullComposition || best.salts || "Pharmaceutical product"
        }`,
        manufacturer: best.manufacturer || "To be determined",
        composition:
          best.fullComposition || best.salts || "Active ingredients as per formulation",
        saltComposition: best.salts || best.fullComposition,
        hsnCode: "30049099",
        gstRate: safeNumber(best.gstPercent) ?? 12,
        gstType: "EXCLUSIVE",
        schedule: best.schedule || "H",
        packSize: best.packSize || undefined,
        mrp:
          safeNumber(best.dpcoCeilingPriceInr) ??
          safeNumber(best.priceInr) ??
          undefined,
        unitPrice:
          safeNumber(best.priceInr) !== undefined
            ? (safeNumber(best.priceInr) as number) * 0.9
            : undefined,
        confidence: 75,
        verificationStatus: "scanned_unverified",
        source: "drug_library",
        sources: ["Drug Library Database"],
      };

      return { found: true, details };
    }

    // -----------------------------
    // Step 4: Fallback
    // -----------------------------
    return {
      found: false,
      details: fallbackDetails(normalized),
      error: "Product not found in database. Please enter details manually.",
    };
  } catch (error: any) {
    console.error("Enhanced barcode lookup error:", error);
    return {
      found: false,
      details: fallbackDetails(normalizeBarcode(barcode)),
      error: error?.message || "Failed to lookup product",
    };
  }
}

/**
 * Calculate confidence score based on data completeness
 */
export function calculateConfidence(
  details: Partial<EnhancedProductDetails>
): number {
  const fields = {
    name:
      !!details.name &&
      !details.name.includes("Product") &&
      !details.name.includes("Generic"),
    manufacturer: !!details.manufacturer && details.manufacturer !== "To be determined",
    composition:
      !!details.composition &&
      details.composition !== "Active ingredients as per formulation",
    hsnCode: !!details.hsnCode,
    gstRate: typeof details.gstRate === "number" && details.gstRate > 0,
    category: !!details.category && details.category !== "General",
    description: !!details.description && !details.description.toLowerCase().includes("to be verified"),
  };

  const filledFields = Object.values(fields).filter(Boolean).length;
  const totalFields = Object.keys(fields).length;
  const baseScore = Math.round((filledFields / totalFields) * 100);

  if (details.source === "internal_product") return 100;
  if (details.source === "drug_library") return Math.min(baseScore + 15, 95);
  if (details.source === "ai_lookup") return Math.min(baseScore + 5, 85);

  return Math.max(baseScore, 0);
}
