export type BarcodeType = "EAN8" | "EAN13" | "UPCA" | "INMED";

export function isInmedCode(input: string): boolean {
  return /^INMED-\d{6}$/.test((input ?? "").toString().trim());
}

/**
 * For EAN/UPC we normalize to digits only.
 * For INMED, we must NOT normalize to digits because it is alphanumeric.
 */
export function normalizeBarcode(input: string): string {
  return (input ?? "").toString().replace(/[^\d]/g, "");
}

export function detectBarcodeType(code: string): BarcodeType | null {
  if (code.length === 8) return "EAN8";
  if (code.length === 13) return "EAN13";
  if (code.length === 12) return "UPCA";
  return null;
}

function computeEanLikeCheckDigit(bodyDigits: string): number {
  const digits = bodyDigits.split("").map(Number);
  let sum = 0;

  for (let i = 0; i < digits.length; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }

  return (10 - (sum % 10)) % 10;
}

export function validateCheckDigit(
  type: Exclude<BarcodeType, "INMED">,
  code: string
): boolean {
  if (!/^\d+$/.test(code)) return false;

  if (type === "EAN13") {
    if (code.length !== 13) return false;
    return computeEanLikeCheckDigit(code.slice(0, 12)) === Number(code[12]);
  }

  if (type === "EAN8") {
    if (code.length !== 8) return false;
    return computeEanLikeCheckDigit(code.slice(0, 7)) === Number(code[7]);
  }

  if (type === "UPCA") {
    if (code.length !== 12) return false;
    return computeEanLikeCheckDigit(code.slice(0, 11)) === Number(code[11]);
  }

  return false;
}

/**
 * Unified barcode validator (EAN / UPC / INMED)
 */
export function validateBarcode(input: string, forcedType?: BarcodeType) {
  const raw = (input ?? "").toString().trim();

  // ✅ 1) INMED support
  if (forcedType === "INMED" || isInmedCode(raw)) {
    if (!isInmedCode(raw)) {
      return {
        ok: false as const,
        error: "Invalid INMED format (expected INMED-000001)",
        normalized: raw,
        type: "INMED" as const,
      };
    }

    return {
      ok: true as const,
      normalized: raw,
      type: "INMED" as const,
    };
  }

  // ✅ 2) EAN / UPC
  const normalized = normalizeBarcode(raw);

  if (!normalized) {
    return {
      ok: false as const,
      error: "Barcode is empty",
      normalized,
      type: null,
    };
  }

  if (!/^\d+$/.test(normalized)) {
    return {
      ok: false as const,
      error: "Barcode must be digits only",
      normalized,
      type: null,
    };
  }

  const type =
    (forcedType ?? detectBarcodeType(normalized)) as
      | Exclude<BarcodeType, "INMED">
      | null;

  if (!type) {
    return {
      ok: false as const,
      error: "Unsupported barcode length (must be 8, 12, or 13 digits)",
      normalized,
      type: null,
    };
  }

  if (!validateCheckDigit(type, normalized)) {
    return {
      ok: false as const,
      error: "Invalid check digit",
      normalized,
      type,
    };
  }

  return {
    ok: true as const,
    normalized,
    type,
  };
}
