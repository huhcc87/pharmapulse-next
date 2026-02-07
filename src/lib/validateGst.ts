import { GST_STATE_CODE_SET } from "@/lib/gstStateCodes";

export function assertValidGstStateCode(code: unknown): asserts code is string {
  if (typeof code !== "string") throw new Error("Place of supply is required.");
  const c = code.trim();
  if (!GST_STATE_CODE_SET.has(c)) throw new Error("Invalid GST state code.");
}

export function validateGSTINFormat(gstin: string) {
  // format-only validation (safe baseline)
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
    gstin.trim().toUpperCase()
  );
}
