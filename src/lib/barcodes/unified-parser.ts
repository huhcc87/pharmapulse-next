/**
 * Unified Barcode Parser
 * 
 * Detects and parses EAN, HSN, and INMED codes
 * Returns normalized code and type for product lookup
 */

import { validateBarcode, type BarcodeType } from "./validate";

export type UnifiedBarcodeType = BarcodeType | "HSN";

export interface UnifiedBarcodeResult {
  ok: boolean;
  type: UnifiedBarcodeType | null;
  normalized: string;
  original: string;
  error?: string;
}

/**
 * Detect if a code is an HSN code
 * HSN codes are typically 4-8 digits (India's Harmonized System of Nomenclature)
 */
function isHsnCode(code: string): boolean {
  // HSN codes are typically 4-8 digits
  // Common patterns: 4 digits (chapter), 6 digits (heading), 8 digits (sub-heading)
  const digitsOnly = code.replace(/[^\d]/g, "");
  return /^\d{4,8}$/.test(digitsOnly);
}

/**
 * Normalize HSN code (remove non-digits, ensure proper length)
 */
function normalizeHsnCode(code: string): string {
  const digitsOnly = code.replace(/[^\d]/g, "");
  // HSN codes can be 4, 6, or 8 digits - return as-is if valid length
  if (digitsOnly.length >= 4 && digitsOnly.length <= 8) {
    return digitsOnly;
  }
  return digitsOnly;
}

/**
 * Unified barcode parser that detects EAN, HSN, and INMED codes
 */
export function parseUnifiedBarcode(input: string): UnifiedBarcodeResult {
  const raw = (input ?? "").toString().trim();

  if (!raw) {
    return {
      ok: false,
      type: null,
      normalized: "",
      original: raw,
      error: "Barcode is empty",
    };
  }

  // 1. Check for INMED codes first (format: INMED-000001)
  if (/^INMED-\d{6}$/i.test(raw)) {
    return {
      ok: true,
      type: "INMED",
      normalized: raw.toUpperCase(),
      original: raw,
    };
  }

  // 2. Check for HSN codes (4-8 digits)
  if (isHsnCode(raw)) {
    const normalized = normalizeHsnCode(raw);
    if (normalized.length >= 4 && normalized.length <= 8) {
      return {
        ok: true,
        type: "HSN",
        normalized,
        original: raw,
      };
    }
  }

  // 3. Check for EAN/UPC codes (standard barcode validation)
  const barcodeResult = validateBarcode(raw);
  
  if (barcodeResult.ok) {
    return {
      ok: true,
      type: barcodeResult.type,
      normalized: barcodeResult.normalized,
      original: raw,
    };
  }

  // 4. If nothing matches, return error
  return {
    ok: false,
    type: null,
    normalized: raw.replace(/[^\d]/g, ""), // Try to normalize anyway
    original: raw,
    error: barcodeResult.error || "Unknown barcode format. Expected EAN (8/12/13 digits), HSN (4-8 digits), or INMED-000001",
  };
}

/**
 * Get lookup strategy based on barcode type
 */
export function getLookupStrategy(type: UnifiedBarcodeType): {
  field: string;
  description: string;
} {
  switch (type) {
    case "EAN8":
    case "EAN13":
    case "UPCA":
      return {
        field: "barcodeValue",
        description: "EAN/UPC barcode",
      };
    case "INMED":
      return {
        field: "internalCode",
        description: "Internal medicine code",
      };
    case "HSN":
      return {
        field: "hsnCode",
        description: "HSN code",
      };
    default:
      return {
        field: "barcodeValue",
        description: "Unknown",
      };
  }
}
