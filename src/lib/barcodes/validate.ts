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
  // NOTE: this function expects DIGITS ONLY input (EAN/UPC). INMED is handled earlier.
  if (code.length === 8) return "EAN8";
  if (code.length === 13) return "EAN13";
  if (code.length === 12) return "UPCA";
  return null;
}

function computeEanLikeCheckDigit(bodyDigits: string): number {
  // Works for EAN-13 body (12 digits) and EAN-8 body (7 digits) and UPC-A body (11 digits)
  // weighting: starting from leftmost body digit: positions 1..n
  // sum odd positions *1 + even positions *3, then (10 - sum%10)%10
  const digits = bodyDigits.split("").map((c) => Number(c));
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
    const body = code.slice(0, 12);
    const check = Number(code[12]);
    return computeEanLikeCheckDigit(body) === check;
  }

  if (type === "EAN8") {
    if (code.length !== 8) return false;
    const body = code.slice(0, 7);
    const check = Number(code[7]);
    return computeEanLikeCheckDigit(body) === check;
  }

  if (type === "UPCA") {
    if (code.length !== 12) return false;
    const body = code.slice(0, 11);
    const check = Number(code[11]);
    return computeEanLikeCheckDigit(body) === check;
  }

  return false;
}

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
    return { ok: true as const, normalized: raw, type: "INMED" as const };
  }

  // ✅ 2) EAN/UPC
  const normalized = normalizeBarcode(raw);

  if (!normalized) {
    return { ok: false as const, error: "Barcode is empty", normalized, type: null as const };
  }
  if (!/^\d+$/.test(normalized)) {
    return { ok: false as const, error: "Barcode must be digits only", normalized, type: null as const };
  }

  const type = (forcedType ?? detectBarcodeType(normalized)) as Exclude<BarcodeType, "INMED"> | null;

  if (!type || type === "INMED") {
    return {
      ok: false as const,
      error: "Unsupported barcode length (must be 8, 12, or 13 digits) or INMED-000001",
      normalized,
      type: null as const,
    };
  }

  if (!validateCheckDigit(type, normalized)) {
    return { ok: false as const, error: "Invalid check digit", normalized, type };
  }

  return { ok: true as const, normalized, type };
}
