/**
 * Enhanced Barcode Lookup Service
 * Auto-populates product details with high confidence from Drug Library
 * Supports EAN/HSN/INMED codes with verification system
 */

import { prisma } from "@/lib/prisma";

export type VerificationStatus = "scanned_unverified" | "pharmacist_verified" | "admin_verified";

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
  sources?: string[]; // Data sources used
}

/**
 * Enhanced barcode lookup with drug library integration
 * Returns complete product details with confidence score
 */
export async function enhancedBarcodeLookup(
  barcode: string,
  tenantId: number = 1
): Promise<{
  found: boolean;
  details?: EnhancedProductDetails;
  error?: string;
}> {
  try {
    // Normalize barcode (remove spaces, uppercase for INMED)
    const normalized = barcode.trim().toUpperCase();

    // Step 1: Check internal Product table (highest priority - 100% confidence)
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
        // Add verification fields if they exist
      },
    });

    if (internalProduct) {
      return {
        found: true,
        details: {
          name: internalProduct.name,
          category: internalProduct.category || "General",
          description: internalProduct.description || `${internalProduct.name} - Pharmaceutical product`,
          manufacturer: internalProduct.manufacturer || "To be determined",
          composition: internalProduct.composition || internalProduct.saltComposition || "Active ingredients as per formulation",
          saltComposition: internalProduct.saltComposition || internalProduct.composition,
          hsnCode: internalProduct.hsnCode || "30049099",
          gstRate: internalProduct.gstRate ? Number(internalProduct.gstRate) : 12,
          gstType: (internalProduct.gstType as "EXCLUSIVE" | "INCLUSIVE") || "EXCLUSIVE",
          schedule: internalProduct.schedule || "H",
          mrp: internalProduct.mrp ? Number(internalProduct.mrp) : undefined,
          unitPrice: internalProduct.salePrice ? Number(internalProduct.salePrice) : (internalProduct.unitPrice ? Number(internalProduct.unitPrice) : undefined),
          confidence: 100, // Internal product = 100% confidence
          verificationStatus: "pharmacist_verified", // Assuming verified if in system
          source: "internal_product",
          sources: ["Internal Product Database"],
        },
      };
    }

    // Step 2: Search Drug Library by brand name patterns (EAN might be in name/description)
    // Note: Drug Library doesn't have barcode field, so we search by various fields
    // In production, consider adding barcode field to DrugLibrary table
    const drugLibrarySearch = await prisma.drugLibrary.findMany({
      where: {
        OR: [
          { qrCode: { contains: normalized, mode: "insensitive" } },
          { brandName: { contains: normalized.slice(-6), mode: "insensitive" } }, // Last 6 digits might match
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

    // Step 3: For EAN barcodes (13 digits starting with 890), try web search patterns
    // This simulates looking up common Indian pharmaceutical barcodes
    if (normalized.length === 13 && normalized.startsWith('890')) {
      // Try to find similar patterns in drug library
      // In production, this could call an external API or use ML matching
      
      if (drugLibrarySearch.length > 0) {
        const bestMatch = drugLibrarySearch[0];
        return {
          found: true,
          details: {
            name: bestMatch.brandName || `Product ${normalized.slice(-6)}`,
            category: bestMatch.category || "General",
            description: `${bestMatch.brandName} - ${bestMatch.fullComposition || bestMatch.salts || "Pharmaceutical product"}`,
            manufacturer: bestMatch.manufacturer || "To be determined",
            composition: bestMatch.fullComposition || bestMatch.salts || "Active ingredients as per formulation",
            saltComposition: bestMatch.salts || bestMatch.fullComposition,
            hsnCode: "30049099", // Default for medicines
            gstRate: bestMatch.gstPercent ? Number(bestMatch.gstPercent) : 12,
            gstType: "EXCLUSIVE",
            schedule: bestMatch.schedule || "H",
            packSize: bestMatch.packSize || undefined,
            mrp: bestMatch.dpcoCeilingPriceInr ? Number(bestMatch.dpcoCeilingPriceInr) : (bestMatch.priceInr ? parseFloat(String(bestMatch.priceInr)) : undefined),
            unitPrice: bestMatch.priceInr ? parseFloat(String(bestMatch.priceInr)) * 0.9 : undefined,
            confidence: 85, // Drug library match = 85% confidence (needs verification)
            verificationStatus: "scanned_unverified",
            source: "drug_library",
            sources: ["Drug Library Database", "CDSCO"],
          },
        };
      }
    }

    // Step 4: Fallback - return placeholder with low confidence (requires manual entry)
    return {
      found: false,
      details: {
        name: `Product ${normalized.slice(-6)}`, // Placeholder - user must enter real name
        category: "General",
        description: "Pharmaceutical product - details to be verified",
        manufacturer: "To be determined",
        composition: "Active ingredients as per formulation",
        hsnCode: "30049099",
        gstRate: 12,
        gstType: "EXCLUSIVE",
        confidence: 0, // No match = 0% confidence
        verificationStatus: "scanned_unverified",
        source: "manual",
        sources: [],
      },
      error: "Product not found in database. Please enter details manually.",
    };
  } catch (error: any) {
    console.error("Enhanced barcode lookup error:", error);
    return {
      found: false,
      error: error.message || "Failed to lookup product",
    };
  }
}

/**
 * Calculate confidence score based on data completeness
 */
export function calculateConfidence(details: Partial<EnhancedProductDetails>): number {
  const fields = {
    name: details.name && !details.name.includes("Product") && !details.name.includes("Generic"),
    manufacturer: details.manufacturer && details.manufacturer !== "To be determined",
    composition: details.composition && details.composition !== "Active ingredients as per formulation",
    hsnCode: !!details.hsnCode,
    gstRate: details.gstRate && details.gstRate > 0,
    category: details.category && details.category !== "General",
    description: details.description && !details.description.includes("to be verified"),
  };

  const filledFields = Object.values(fields).filter(Boolean).length;
  const totalFields = Object.keys(fields).length;
  const baseScore = Math.round((filledFields / totalFields) * 100);

  // Bonus points for source
  if (details.source === "internal_product") return 100;
  if (details.source === "drug_library") return Math.min(baseScore + 15, 95);
  if (details.source === "ai_lookup") return Math.min(baseScore + 5, 85);
  
  return Math.max(baseScore, 0);
}
