# AI GST + POS (India) Implementation Roadmap for PharmaPulse

This roadmap assumes a Next.js + Prisma app (what your repo looks like) and adds:
1) Barcode scanning → cart
2) GST-aware billing (CGST/SGST vs IGST)
3) HSN mapping + validation
4) Printable invoice/receipt
5) Optional: Local Print Bridge for thermal printers/cash drawer

---

## A) Hardware reality (what works reliably)
### Barcode scanner
- Use a USB/Bluetooth HID scanner (“keyboard wedge”).
- Your web UI captures fast key bursts; no special driver required.

### Thermal receipt printer + cash drawer
Browsers cannot reliably send raw ESC/POS commands.
**Recommended approach:** run a *Local Print Bridge* on the POS computer:
- Your app creates a `PrintJob` row (kind=receipt, payload=JSON).
- Bridge polls `/api/print/jobs` or DB, renders ESC/POS and prints.
- Cash drawer opens via printer kick-port.

### Card/UPI terminal
Payment device is separate; your app stores only confirmation/reference fields.

---

## B) Database (Prisma)
Copy models from:
- `prisma/schema.models.pos_gst.prisma`
Into your `prisma/schema.prisma`, then run:
- `npx prisma migrate dev -n pos_gst_billing`
- `npx prisma generate`

---

## C) POS UI
Files:
- `src/app/pos/page.tsx` : POS screen (scan/search/cart/totals/checkout)
- `src/hooks/useBarcodeScanner.ts` : scanner capture (HID)
- `src/lib/gst.ts` : GST calculator and bucketing

---

## D) APIs
- `GET /api/pos/product?barcode=...`
- `GET /api/pos/search?q=...`
- `POST /api/pos/checkout` : server-side totals + persist invoice

---

## E) Importing your drug library + HSN/GST mapping
Use scripts:
- `scripts/import-drug-library.ts`
- `scripts/map-hsn-gst.ts`

Typical order:
1) Import master:
   `npx ts-node scripts/import-drug-library.ts ./data/Master\ Excel-india_allopathy_medicines_253973_fixed.xlsx`
2) Map HSN/GST:
   `npx ts-node scripts/map-hsn-gst.ts ./data/India_Pharma_HSN_GST.xlsx`

---

## F) AI enhancements (safe + audit-friendly)
**Goal:** AI suggests HSN/GST but never silently overrides.
Implement:
- Confidence score
- “Needs Review” queue
- Audit trail (who approved + when)

Suggested policy:
- If match is exact by internalCode/barcode → auto-apply
- Else if name similarity high → propose, do not auto-apply
- Else → require manual selection

---

## G) Printing options
### 1) Browser print (works now)
Receipt page:
- `/pos/receipt/:id`
Prints HTML using browser dialog (simple, not thermal-perfect).

### 2) Local Print Bridge (recommended)
Create a small Node service that:
- pulls `PrintJob` records (QUEUED)
- prints via ESC/POS library
- updates status PRINTED/FAILED

(You can add this after POS is stable.)
