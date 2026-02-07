# India-Ready Billing, GST & Payments + Inventory Intelligence Implementation

## Summary

Complete implementation of **India-ready Billing, GST & Payments** plus **Inventory Intelligence from POS** for the pharmapulse-next POS workflow.

---

## Part 1: Billing, GST & Payments (India)

### A) Advanced GST Engine

#### A1) Prisma Schema Updates

**Modified Models:**
- `Batch`: Added `nearExpiryDiscountPct`, `purchasePrice`, `mrp`
- `DrugLibrary`: Added `hsnCode`, `taxCategory`, `isScheduleDrug`
- `InventoryItem`: Added `batchId` relation, `mrp`, expiry indexing
- Existing models already have GST fields from previous implementation

**New Fields:**
```prisma
// Batch model
nearExpiryDiscountPct Decimal? @db.Decimal(5, 2) @map("near_expiry_discount_pct")
purchasePrice         Float?   @map("purchase_price")
mrp                   Float?

// DrugLibrary model
hsnCode               String?  @map("hsn_code")
taxCategory           String?  @default("TAXABLE") @map("tax_category")
isScheduleDrug        Boolean  @default(false) @map("is_schedule_drug")

// InventoryItem model
batchId               Int?     @map("batch_id")
mrp                   Float?
```

#### A2) Server-side GST Calculation

**File:** `src/lib/gst/advanced.ts` (already exists)
- Intra/inter-state determination
- CGST/SGST vs IGST split
- Batch-level GST overrides
- Tax-exempt handling

#### A3) HSN Auto-mapping + Enforcement

**Files:**
- `src/lib/hsn/auto-map.ts` - Auto-mapping logic
- `src/app/api/hsn/auto-map/route.ts` - API endpoint
- `src/app/api/hsn/set/route.ts` - Manual HSN setting
- `src/components/pos/HsnQuickFixModal.tsx` - UI modal

**Features:**
- Auto-mapping using `HsnRule` patterns
- Blocks invoice issuance if HSN missing (allows draft)
- Quick-fix modal for missing HSN

#### A4) Invoice Preview + QR

**Files:**
- `src/lib/invoice/qr.ts` - QR generation
- `src/components/pos/CheckoutModal.tsx` - Invoice preview UI
- `src/app/invoices/[id]/print/page.tsx` - Print view

**Features:**
- Invoice preview before issuance
- QR code (UPI payload or verification string)
- Print-friendly invoice page

#### A5) GSTR-1 Export

**File:** `src/app/api/reports/gstr1/route.ts` (already exists)
- CSV export with invoice lines
- Includes: invoiceNumber, invoiceDate, customerGSTIN, placeOfSupplyStateCode, supplyType, hsnCode, gstRate, taxableValue, cgst, sgst, igst, lineTotal

**File:** `src/app/api/reports/hsn-summary/route.ts` (NEW)
- HSN-wise summary report
- Aggregates: totalTaxable, totalCGST, totalSGST, totalIGST per HSN code

#### A6) E-invoice Payload Builder

**File:** `src/lib/invoice/e-invoice.ts` (NEW)
- Builds NIC-compatible e-invoice JSON structure
- Stores in `Invoice.eInvoicePayload`
- Structure: TranDtls, SellerDtls, BuyerDtls, ItemList, ValDtls, PayDtls

---

### B) Flexible Payments

#### B1) Payment Methods + Split Payments

**Implementation:**
- `Payment` model supports: CASH, CARD, UPI, WALLET, CREDIT
- `CheckoutModal` allows multiple payment rows
- Server validates sum == grandTotal (or <= for partial)

#### B2) Partial Payments

**File:** `src/app/api/invoices/[id]/record-payment/route.ts` (NEW)
- Add payments to existing invoices
- Updates `Invoice.status` to PARTIALLY_PAID or PAID
- Tracks `paidAmountPaise` vs `totalInvoicePaise`

#### B3) Credit Customers

**Implementation:**
- `Customer.isCreditCustomer`, `creditLimit`, `currentCreditBalance`
- `CreditAccount` and `CreditLedger` models for tracking
- Enforces credit limit, updates balance atomically
- `issue-invoice` API handles credit payments

#### B4) Payment Failure Recovery

**Features:**
- Idempotency: `Idempotency-Key` header support
- Status tracking: INITIATED → SUCCESS/FAILED
- Retry payment and "Mark as paid" actions
- Transaction-safe: invoice created with status DRAFT if payment fails

---

## Part 2: Inventory Intelligence from POS

### A) Batch & Expiry Enforcement

#### A1) Mandatory Batch Selection

**Files:**
- `src/lib/inventory/fefo.ts` - FEFO logic utilities
- `src/components/pos/BatchSelectorModal.tsx` - Batch selection UI
- `src/app/api/drugs/[id]/batches/route.ts` - Batch listing endpoint

**Features:**
- FEFO (First Expiry First Out) batch selection
- Auto-selects best batch if not specified
- Blocks add-to-cart if no batch available

#### A2) Expiry Warnings

**Implementation:**
- Calculates days-to-expiry
- Warnings:
  - ≤90 days: "Near expiry"
  - ≤60 days: "Expiring soon"
  - ≤30 days: "Critical expiry"
  - <0 days: "Expired" (blocked)
- Returns from `/api/pos/validate-cart` and search endpoints

#### A3) FEFO Logic

**File:** `src/lib/inventory/fefo.ts`
- `getFefoBatches()` - Returns batches ordered by expiry (ascending)
- `selectBestBatch()` - Selects first non-expired batch with enough stock
- FIFO tie-breaker: if equal expiry, oldest batch first

#### A4) Near-Expiry Discount Suggestions

**Implementation:**
- `getSuggestedDiscount()` - Calculates suggested discount percent
- Default rules: 10% for ≤30 days, 5% for ≤60 days
- Can use `batch.nearExpiryDiscountPct` if configured
- Shows in UI as "Suggested discount"
- Only pharmacist/owner can apply (audit log)

### B) Stock Health Indicators

#### B1) Visual Indicators

**File:** `src/lib/inventory/stock-indicators.ts`
- Stock status: 🟢 IN_STOCK, 🟡 LOW_STOCK, 🔴 OUT_OF_STOCK
- Expiry status: ⏰ NEAR, ⚠️ SOON, 🚨 CRITICAL, ❌ EXPIRED
- Combined `InventoryHealth` object

**Usage:**
- Drug search results show indicators
- Cart lines show selected batch + expiry
- Backend endpoints return health data

---

## New/Modified Files

### Core Utilities
- `src/lib/inventory/fefo.ts` - FEFO logic and batch selection
- `src/lib/inventory/stock-indicators.ts` - Stock health indicators
- `src/lib/invoice/e-invoice.ts` - E-invoice payload builder

### API Endpoints
- `src/app/api/drugs/search/route.ts` - Enhanced drug search with stock indicators
- `src/app/api/drugs/[id]/batches/route.ts` - Batch listing (FEFO ordered)
- `src/app/api/invoices/[id]/record-payment/route.ts` - Record payment on invoice
- `src/app/api/reports/hsn-summary/route.ts` - HSN summary report

### UI Components
- `src/components/pos/BatchSelectorModal.tsx` - Batch selection modal
- `src/components/DrugLibraryModal.tsx` - Updated with stock indicators

### Modified Files
- `prisma/schema.prisma` - Added batch and inventory fields
- `src/app/api/pos/validate-cart/route.ts` - Enhanced with FEFO batch suggestions and expiry warnings
- `src/app/api/pos/issue-invoice/route.ts` - Added e-invoice payload generation

---

## Migration Steps

1. **Update Prisma schema:**
   ```bash
   cd pharmapulse-next
   npx prisma migrate dev --name add_batch_expiry_inventory_intelligence
   ```

2. **Verify schema:**
   ```bash
   npx prisma generate
   ```

3. **Restart development server:**
   ```bash
   npm run dev
   ```

---

## Testing Checklist

### GST & Billing
- [ ] Invoice preview shows correct CGST/SGST/IGST split
- [ ] HSN missing blocks invoice issuance (allows draft)
- [ ] Auto-mapping suggests HSN for products
- [ ] GSTR-1 export generates correct CSV
- [ ] HSN summary report aggregates correctly

### Payments
- [ ] Split payments work (multiple methods)
- [ ] Partial payments set status correctly
- [ ] Credit customers enforce limit
- [ ] Record payment endpoint updates invoice status
- [ ] Payment failure recovery works

### Inventory Intelligence
- [ ] Batch selection uses FEFO (earliest expiry first)
- [ ] Expiry warnings show at appropriate thresholds
- [ ] Near-expiry discount suggestions appear
- [ ] Stock indicators show in search results
- [ ] Out-of-stock items blocked from cart
- [ ] Expired batches blocked from selection

---

## API Endpoints Summary

### POS
- `POST /api/pos/validate-cart` - Validates cart, returns issues/warnings, FEFO batch suggestions
- `POST /api/pos/issue-invoice` - Issues invoice with GST computation, payments, stock deduction

### Inventory
- `GET /api/drugs/search?q=...` - Search drugs with stock indicators and best batch
- `GET /api/drugs/[id]/batches` - Get FEFO-ordered batches for a drug

### Invoices
- `GET /api/invoices/[id]` - Get invoice details
- `GET /api/invoices/[id]/print` - Print-friendly invoice view
- `POST /api/invoices/[id]/record-payment` - Record payment on invoice

### HSN
- `POST /api/hsn/auto-map` - Auto-map HSN to products
- `POST /api/hsn/set` - Manually set HSN code

### Reports
- `GET /api/reports/gstr1?from=...&to=...` - GSTR-1 CSV export
- `GET /api/reports/hsn-summary?from=...&to=...` - HSN summary report

---

## Key Features

✅ **GST-correct invoices** with CGST/SGST/IGST split  
✅ **HSN enforcement** with auto-mapping  
✅ **Batch-level GST accuracy**  
✅ **Invoice preview + QR code**  
✅ **GSTR-1 export**  
✅ **E-invoice payload** structure  
✅ **Split payments** (multiple methods)  
✅ **Partial payments** (pay later)  
✅ **Credit customers** with limit enforcement  
✅ **Payment failure recovery** with idempotency  
✅ **FEFO batch selection** (earliest expiry first)  
✅ **Expiry warnings** (90/60/30 days)  
✅ **Near-expiry discount suggestions**  
✅ **Stock health indicators** (visual cues)  

---

## Notes

- All calculations are **server-side recomputed**
- All operations use **Prisma transactions** for data consistency
- **Audit logs** for sensitive actions (GST overrides, discounts, payments)
- **Concurrency-safe** stock deduction using transactions
- **Role-based access** for modifying GST, batch, price, schedule drugs

---

## Next Steps (Optional)

1. **NIC E-invoice Integration:** Connect to government e-invoice API
2. **Payment Gateway Integration:** UPI/Card gateway APIs
3. **Automated Discount Rules:** Configure threshold-based discounts
4. **Expiry Alerts:** Email/SMS notifications for near-expiry batches
5. **Advanced Analytics:** Dashboard for inventory health metrics
