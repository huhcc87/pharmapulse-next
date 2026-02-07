// HSN Code lookup for pharmaceutical products
// This provides a mapping of common drug categories to HSN codes

export interface HsnSuggestion {
  hsnCode: string;
  gstRate: number; // as percentage (e.g., 12 for 12%)
  confidence: number; // 0-1
  rationale: string;
  source: "DEFAULT" | "AI_SUGGESTED" | "MANUAL";
}

// Common HSN codes for pharmaceutical products
const HSN_MAPPING: Record<string, { hsn: string; gst: number }> = {
  // Medicines and pharmaceutical preparations
  "3004": { hsn: "3004", gst: 12 }, // Medicaments (medicines)
  "3003": { hsn: "3003", gst: 12 }, // Medicaments consisting of mixed products
  "3002": { hsn: "3002", gst: 12 }, // Human blood; animal blood; vaccines
  "3001": { hsn: "3001", gst: 12 }, // Glands and other organs for organo-therapeutic uses
  
  // Medical devices
  "9018": { hsn: "9018", gst: 12 }, // Instruments and appliances used in medical, surgical, dental or veterinary sciences
  "9021": { hsn: "9021", gst: 12 }, // Orthopaedic appliances
  
  // Default for medicines
  "DEFAULT_MEDICINE": { hsn: "3004", gst: 12 },
};

// Category-based HSN mapping
const CATEGORY_HSN: Record<string, string> = {
  "tablet": "3004",
  "capsule": "3004",
  "syrup": "3004",
  "injection": "3004",
  "ointment": "3004",
  "cream": "3004",
  "drops": "3004",
  "suspension": "3004",
  "powder": "3004",
};

/**
 * Get HSN code suggestion based on product information
 */
export function suggestHsnCode(product: {
  brandName?: string;
  genericName?: string;
  category?: string;
  type?: string;
  composition?: string;
}): HsnSuggestion {
  // Check category first
  if (product.category) {
    const categoryLower = product.category.toLowerCase();
    for (const [key, hsn] of Object.entries(CATEGORY_HSN)) {
      if (categoryLower.includes(key)) {
        return {
          hsnCode: hsn,
          gstRate: 12,
          confidence: 0.85,
          rationale: `Based on category: ${product.category}`,
          source: "DEFAULT",
        };
      }
    }
  }

  // Check type
  if (product.type) {
    const typeLower = product.type.toLowerCase();
    for (const [key, hsn] of Object.entries(CATEGORY_HSN)) {
      if (typeLower.includes(key)) {
        return {
          hsnCode: hsn,
          gstRate: 12,
          confidence: 0.80,
          rationale: `Based on type: ${product.type}`,
          source: "DEFAULT",
        };
      }
    }
  }

  // Default to 3004 for medicines
  return {
    hsnCode: "3004",
    gstRate: 12,
    confidence: 0.70,
    rationale: "Default HSN code for pharmaceutical preparations",
    source: "DEFAULT",
  };
}

/**
 * Get HSN code from drug library item
 */
export async function getHsnFromDrugLibrary(
  drugLibraryId: number,
  prisma: any
): Promise<HsnSuggestion | null> {
  try {
    const drug = await prisma.drugLibrary.findUnique({
      where: { id: drugLibraryId },
      select: {
        brandName: true,
        category: true,
        type: true,
        fullComposition: true,
        salts: true,
      },
    });

    if (!drug) return null;

    return suggestHsnCode({
      brandName: drug.brandName,
      category: drug.category || undefined,
      type: drug.type || undefined,
      composition: drug.fullComposition || drug.salts || undefined,
    });
  } catch (error) {
    console.error("Error fetching HSN from drug library:", error);
    return null;
  }
}










