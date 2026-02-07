/**
 * HSN → GST Auto-Mapping Configuration
 * Maps HSN code prefixes to default GST rates and category suggestions
 * 
 * IMPORTANT: These are "starter defaults" and must be verified against
 * supplier invoice or GST rate schedule. Not all products follow these rates.
 */

export interface HsnGstMapping {
  hsnPrefix: string;
  defaultGstRate: number; // 0, 5, 12, 18, 28
  defaultGstType: "EXCLUSIVE" | "INCLUSIVE";
  categorySuggestion?: string;
  notes: string; // For audit/help text
}

/**
 * HSN → GST Mapping Database
 * Priority: Match longest prefix first (8-digit > 6-digit > 4-digit > 2-digit)
 * 
 * Note: These mappings are guidelines. Actual GST rates may vary based on:
 * - Product-specific notifications
 * - State-specific rules
 * - Tax exemptions
 * - Always verify with supplier invoice and latest GST rate schedule
 */
export const HSN_GST_MAPPINGS: HsnGstMapping[] = [
  // 8-digit specific codes (highest priority)
  { hsnPrefix: "30049099", defaultGstRate: 12, defaultGstType: "EXCLUSIVE", categorySuggestion: "General", notes: "Medicaments in measured doses - retail packs. Verify with invoice." },
  { hsnPrefix: "30049090", defaultGstRate: 12, defaultGstType: "EXCLUSIVE", categorySuggestion: "General", notes: "Medicaments in measured doses. Verify with invoice." },
  
  // 6-digit codes
  { hsnPrefix: "300490", defaultGstRate: 12, defaultGstType: "EXCLUSIVE", categorySuggestion: "General", notes: "Medicaments in measured doses. Verify with invoice." },
  
  // 4-digit codes (most common for pharmacies)
  { hsnPrefix: "3004", defaultGstRate: 12, defaultGstType: "EXCLUSIVE", categorySuggestion: "General", notes: "Medicaments in measured doses / retail packs. Verify with supplier invoice." },
  { hsnPrefix: "3003", defaultGstRate: 12, defaultGstType: "EXCLUSIVE", categorySuggestion: "General", notes: "Medicaments not in measured doses. Verify with invoice." },
  { hsnPrefix: "3002", defaultGstRate: 5, defaultGstType: "EXCLUSIVE", categorySuggestion: "General", notes: "Blood, antisera, vaccines, etc. Rate varies - verify with invoice." },
  { hsnPrefix: "9018", defaultGstRate: 12, defaultGstType: "EXCLUSIVE", categorySuggestion: "Medical Equipment", notes: "Medical instruments/appliances. Rate varies - verify with invoice." },
  { hsnPrefix: "3306", defaultGstRate: 18, defaultGstType: "EXCLUSIVE", categorySuggestion: "Oral Care", notes: "Oral/dental hygiene products. Rate varies - verify with invoice." },
  { hsnPrefix: "3401", defaultGstRate: 18, defaultGstType: "EXCLUSIVE", categorySuggestion: "Personal Care", notes: "Soaps/cleansers. Rate varies - verify with invoice." },
  { hsnPrefix: "2202", defaultGstRate: 12, defaultGstType: "EXCLUSIVE", categorySuggestion: "Beverages", notes: "Non-alcoholic beverages/health drinks. Rate varies - verify with invoice." },
  { hsnPrefix: "2106", defaultGstRate: 18, defaultGstType: "EXCLUSIVE", categorySuggestion: "Nutritional Supplements", notes: "Nutritional supplements/food preparations. Rate varies - verify with invoice." },
  
  // 2-digit codes (lowest priority, broad categories)
  { hsnPrefix: "30", defaultGstRate: 12, defaultGstType: "EXCLUSIVE", categorySuggestion: "General", notes: "Pharmaceutical products. Verify specific rate with supplier invoice." },
];

/**
 * Sanitize HSN code - extract digits only
 */
export function sanitizeHsnCode(hsnCode: string): string {
  return hsnCode.replace(/\D/g, '');
}

/**
 * Find longest-prefix match for HSN code
 * Returns mapping with longest matching prefix (8-digit > 6-digit > 4-digit > 2-digit)
 */
export function findHsnGstMapping(hsnCode: string): HsnGstMapping | null {
  const sanitized = sanitizeHsnCode(hsnCode);
  
  if (sanitized.length < 2) {
    return null;
  }

  // Sort mappings by prefix length (longest first) for longest-prefix matching
  const sortedMappings = [...HSN_GST_MAPPINGS].sort((a, b) => b.hsnPrefix.length - a.hsnPrefix.length);

  // Find first matching prefix
  for (const mapping of sortedMappings) {
    if (sanitized.startsWith(mapping.hsnPrefix)) {
      return mapping;
    }
  }

  return null;
}

/**
 * Get GST rate suggestion from HSN code
 * Returns mapping with GST rate, type, and category suggestion
 */
export function getGstRateFromHsn(hsnCode: string): {
  gstRate: number;
  gstType: "EXCLUSIVE" | "INCLUSIVE";
  categorySuggestion?: string;
  hsnPrefixUsed: string;
  notes: string;
} | null {
  const mapping = findHsnGstMapping(hsnCode);

  if (!mapping) {
    return null;
  }

  return {
    gstRate: mapping.defaultGstRate,
    gstType: mapping.defaultGstType,
    categorySuggestion: mapping.categorySuggestion,
    hsnPrefixUsed: mapping.hsnPrefix,
    notes: mapping.notes,
  };
}

/**
 * Validate HSN code format
 * Returns validation result with suggestions
 */
export function validateHsnCode(hsnCode: string): {
  valid: boolean;
  warning?: string;
  suggestion?: string;
} {
  const sanitized = sanitizeHsnCode(hsnCode);

  if (!sanitized || sanitized.length === 0) {
    return { valid: true }; // Empty is allowed (optional field)
  }

  if (sanitized.length < 2) {
    return {
      valid: false,
      warning: "HSN code too short (minimum 2 digits)",
    };
  }

  if (sanitized.length > 8) {
    return {
      valid: false,
      warning: "HSN code too long (maximum 8 digits)",
    };
  }

  if (sanitized.length === 2) {
    return {
      valid: true,
      warning: "Use 4-8 digits for GST invoices. 2-digit codes are for internal use only.",
      suggestion: "Consider using 4-digit HSN for better GST classification.",
    };
  }

  if (sanitized.length >= 4 && sanitized.length <= 8) {
    return {
      valid: true,
      suggestion: sanitized.length < 8 
        ? "4-8 digits recommended for GST invoices (e.g., 3004 / 30049099)."
        : undefined,
    };
  }

  return { valid: true };
}
