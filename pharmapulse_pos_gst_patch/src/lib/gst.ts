/**
 * India GST calculator for POS.
 * Supports inclusive/exclusive pricing and intra/inter-state split.
 *
 * - If EXCLUSIVE: tax is added on top of taxable value.
 * - If INCLUSIVE: taxable value is derived from gross price.
 */

export type TaxInclusion = "EXCLUSIVE" | "INCLUSIVE";

export type GSTContext = {
  sellerStateCode: string; // e.g. "27"
  buyerStateCode: string;  // e.g. "27"
};

export type LineInput = {
  hsn?: string | null;
  qty: number;
  unitPrice: number; // per unit
  discount: number;  // per line total discount
  gstRate?: number | null; // percentage, e.g. 5, 12
  taxInclusion: TaxInclusion;
};

export type LineComputed = {
  taxableValue: number; // before GST
  taxValue: number;     // total GST
  total: number;        // taxable + tax (or gross if inclusive)
  split: { cgst: number; sgst: number; igst: number };
};

export function isInterState(ctx: GSTContext) {
  return ctx.sellerStateCode !== ctx.buyerStateCode;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeLine(line: LineInput, ctx: GSTContext): LineComputed {
  const rate = (line.gstRate ?? 0) / 100;

  const gross = line.qty * line.unitPrice - line.discount;

  if (rate <= 0) {
    return {
      taxableValue: round2(gross),
      taxValue: 0,
      total: round2(gross),
      split: { cgst: 0, sgst: 0, igst: 0 },
    };
  }

  const inter = isInterState(ctx);

  let taxable = 0;
  let tax = 0;

  if (line.taxInclusion === "INCLUSIVE") {
    // gross includes GST
    taxable = gross / (1 + rate);
    tax = gross - taxable;
  } else {
    // exclusive
    taxable = gross;
    tax = taxable * rate;
  }

  taxable = round2(taxable);
  tax = round2(tax);

  let cgst = 0, sgst = 0, igst = 0;
  if (inter) {
    igst = tax;
  } else {
    cgst = round2(tax / 2);
    sgst = round2(tax - cgst);
  }

  const total = line.taxInclusion === "INCLUSIVE" ? round2(gross) : round2(taxable + tax);

  return {
    taxableValue: taxable,
    taxValue: tax,
    total,
    split: { cgst, sgst, igst },
  };
}

export type TaxBucket = {
  hsn?: string | null;
  gstRate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
};

export function bucketTaxes(
  lines: Array<LineInput>,
  ctx: GSTContext
): { buckets: TaxBucket[]; subtotal: number; taxTotal: number; grandTotal: number } {
  const map = new Map<string, TaxBucket>();

  let subtotal = 0;
  let taxTotal = 0;
  let grandTotal = 0;

  for (const l of lines) {
    const c = computeLine(l, ctx);
    subtotal += c.taxableValue;
    taxTotal += c.taxValue;
    grandTotal += c.total;

    const key = `${l.hsn ?? ""}::${l.gstRate ?? 0}`;
    const prev = map.get(key) ?? {
      hsn: l.hsn ?? null,
      gstRate: l.gstRate ?? 0,
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
    };

    prev.taxableValue = round2(prev.taxableValue + c.taxableValue);
    prev.cgst = round2(prev.cgst + c.split.cgst);
    prev.sgst = round2(prev.sgst + c.split.sgst);
    prev.igst = round2(prev.igst + c.split.igst);

    map.set(key, prev);
  }

  return {
    buckets: Array.from(map.values()).sort((a, b) => (a.gstRate - b.gstRate) || String(a.hsn).localeCompare(String(b.hsn))),
    subtotal: round2(subtotal),
    taxTotal: round2(taxTotal),
    grandTotal: round2(grandTotal),
  };
}
