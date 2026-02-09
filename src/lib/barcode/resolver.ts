// src/lib/barcode/resolver.ts
export interface ResolveBarcodeResult {
  found: "inventory" | "library" | "none";
  product?: any;
  drug?: any;
  error?: string;
}

/**
 * Client-safe barcode resolver (calls API route)
 * Safe to import from "use client" components.
 */
export async function resolveBarcode(
  code: string,
  tenantId: number = 1,
  branchId: number = 1
): Promise<ResolveBarcodeResult> {
  const qs = new URLSearchParams({
    code,
    tenantId: String(tenantId),
    branchId: String(branchId),
  });

  const res = await fetch(`/api/barcode/resolve?${qs.toString()}`, {
    method: "GET",
  });

  const json = await res.json();

  if (!res.ok) {
    return { found: "none", error: json?.error ?? "Request failed" };
  }

  // expected: { ok: true, result: ResolveBarcodeResult }
  return json?.result ?? { found: "none" };
}
