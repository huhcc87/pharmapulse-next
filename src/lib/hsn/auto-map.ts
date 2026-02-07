// HSN auto-mapping service
import { prisma } from "@/server/prisma";

export type MatchType = "EXACT_NAME" | "CONTAINS" | "SALT" | "BRAND" | "CATEGORY";

export interface HsnMappingSuggestion {
  hsnCode: string;
  description: string;
  gstRate: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  matchType: MatchType;
  matchPattern: string;
}

/**
 * Auto-map HSN code for a product/drug
 */
export async function autoMapHsn(
  productName: string,
  category?: string | null,
  saltComposition?: string | null,
  brandName?: string | null
): Promise<HsnMappingSuggestion | null> {
  // Get all enabled rules ordered by priority
  const rules = await prisma.hsnRule.findMany({
    where: { enabled: true },
    include: { hsnMaster: true },
    orderBy: { priority: "asc" },
  });

  for (const rule of rules) {
    let matches = false;

    switch (rule.matchType) {
      case "EXACT_NAME":
        matches = productName.toLowerCase() === rule.pattern.toLowerCase();
        break;
      case "CONTAINS":
        matches = productName.toLowerCase().includes(rule.pattern.toLowerCase());
        break;
      case "SALT":
        if (saltComposition) {
          matches = saltComposition.toLowerCase().includes(rule.pattern.toLowerCase());
        }
        break;
      case "BRAND":
        if (brandName) {
          matches = brandName.toLowerCase().includes(rule.pattern.toLowerCase());
        }
        break;
      case "CATEGORY":
        if (category) {
          matches = category.toLowerCase() === rule.pattern.toLowerCase();
        }
        break;
    }

    if (matches) {
      const confidence =
        rule.matchType === "EXACT_NAME"
          ? "HIGH"
          : rule.matchType === "CONTAINS" || rule.matchType === "SALT"
          ? "MEDIUM"
          : "LOW";

      return {
        hsnCode: rule.hsnCode,
        description: rule.hsnMaster.description,
        gstRate: Number(rule.hsnMaster.defaultGstRate),
        confidence,
        matchType: rule.matchType as MatchType,
        matchPattern: rule.pattern,
      };
    }
  }

  return null;
}

/**
 * Batch auto-map HSN for multiple items
 */
export async function batchAutoMapHsn(
  items: Array<{
    productId?: number;
    drugLibraryId?: number;
    productName: string;
    category?: string | null;
    saltComposition?: string | null;
    brandName?: string | null;
  }>
): Promise<Map<number, HsnMappingSuggestion | null>> {
  const results = new Map<number, HsnMappingSuggestion | null>();

  await Promise.all(
    items.map(async (item) => {
      const key = item.productId || item.drugLibraryId || 0;
      const suggestion = await autoMapHsn(
        item.productName,
        item.category,
        item.saltComposition,
        item.brandName
      );
      results.set(key, suggestion);
    })
  );

  return results;
}
