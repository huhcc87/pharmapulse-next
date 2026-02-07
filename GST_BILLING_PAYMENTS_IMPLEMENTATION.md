# GST, Billing & Payments Implementation Summary

## ✅ Features Implemented

### A) Advanced GST Engine

#### A1) Data Model Updates
- ✅ Extended `Product` model with `isTaxExempt`, `taxCategory`
- ✅ Extended `Batch` model with `purchaseGstRate`, `saleGstRateOverride`
- ✅ Extended `Org` model with GST settings (legalName, tradeName, address, stateCode, placeOfSupplyPolicy)
- ✅ Extended `Customer` model with credit fields (isCreditCustomer, creditLimit, currentCreditBalance, billingAddress)
- ✅ Extended `Invoice` model with `supplyType`, `placeOfSupplyStateCode`, `eInvoicePayload`
- ✅ Extended `InvoiceLineItem` with `mrpPaise`, `salePricePaise`, `gstRate`, `lineTotalPaise`
- ✅ Extended `Payment` model with `idempotencyKey`, `creditCustomerId`, status `INITIATED`
- ✅ Created `HSNMaster` model for HSN code master data
- ✅ Created `HsnRule` model for auto-mapping rules
- ✅ Created `CreditLedger` model for credit transaction tracking

#### A2) GST Computation Rules
- ✅ **Intra vs Inter-State Determination**: Compares seller and buyer state codes
- ✅ **HSN Auto-Mapping**: Rule-based matching (EXACT_NAME, CONTAINS, SALT, BRAND, CATEGORY)
- ✅ **Tax-Exempt Handling**: Supports EXEMPT and ZERO_RATED categories
- ✅ **Batch-Level GST**: Priority: batch override > product rate > HSN default > 0
- ✅ **Server-Side Recalculation**: All totals computed server-side before saving

#### A3) Invoice Preview + QR
- ✅ Invoice preview endpoint in checkout modal
- ✅ QR code generation for invoice verification
- ✅ Print-friendly invoice page at `/invoices/[id]/print`

#### A4) GSTR-1 Export
- ✅ CSV export endpoint: `GET /api/reports/gstr1?from=YYYY-MM-DD&to=YYYY-MM-DD`
- ✅ Includes all required fields for GSTR-1 filing

#### A5) E-Invoice Readiness
- ✅ `eInvoicePayload` JSON field in Invoice model for future NIC integration

### B) Flexible Payments

#### B1) Payment Methods
- ✅ Cash, Card, UPI, Wallet, Credit (pharmacy account)

#### B2) Split Payments
- ✅ Multiple payment rows in checkout modal
- ✅ Validation: sum == grand total (or <= for partial)

#### B3) Partial Payments
- ✅ Invoice status: PARTIALLY_PAID when paid < total
- ✅ `dueAmount` tracking

#### B4) Credit Customers
- ✅ Credit limit enforcement
- ✅ `currentCreditBalance` atomic updates
- ✅ Credit ledger entries

#### B5) Payment Failure Recovery
- ✅ Idempotency keys to prevent duplicate invoices
- ✅ Payment status: INITIATED → SUCCESS/FAILED
- ✅ Retry payment flow support

## 📁 Files Created/Modified

### New Files
1. `src/lib/gst/advanced.ts` - Advanced GST computation with intra/inter-state logic
2. `src/lib/hsn/auto-map.ts` - HSN auto-mapping service
3. `src/lib/invoice/number.ts` - Invoice number generation
4. `src/lib/invoice/qr.ts` - QR code generation utilities
5. `src/app/api/pos/validate-cart/route.ts` - Cart validation with HSN/stock checks
6. `src/app/api/pos/issue-invoice/route.ts` - Invoice issuance with full GST computation
7. `src/app/api/hsn/auto-map/route.ts` - HSN auto-mapping API
8. `src/app/api/hsn/set/route.ts` - Set HSN code (admin only)
9. `src/app/api/reports/gstr1/route.ts` - GSTR-1 CSV export
10. `src/components/pos/CheckoutModal.tsx` - Enhanced checkout with invoice preview
11. `src/components/pos/HsnQuickFixModal.tsx` - HSN quick-fix modal
12. `src/app/invoices/[id]/print/page.tsx` - Print-friendly invoice page

### Modified Files
1. `prisma/schema.prisma` - Extended models with GST/payment fields
2. `src/app/pos/page.tsx` - Integrated new checkout flow
3. `src/app/api/pos/checkout/route.ts` - Added permission checks (kept for backward compatibility)

## 🗄️ Database Schema Changes

### New Models

#### `HSNMaster`
```prisma
model HSNMaster {
  id          String   @id @default(cuid())
  hsnCode     String   @unique
  description String
  defaultGstRate Decimal
  gstType     String   @default("EXCLUSIVE")
  category    String?
  isActive    Boolean  @default(true)
  ...
}
```

#### `HsnRule`
```prisma
model HsnRule {
  id        Int      @id @default(autoincrement())
  hsnCode   String
  matchType String   // EXACT_NAME, CONTAINS, SALT, BRAND, CATEGORY
  pattern   String
  priority  Int      @default(100)
  enabled   Boolean  @default(true)
  ...
}
```

#### `CreditLedger`
```prisma
model CreditLedger {
  id            Int      @id @default(autoincrement())
  customerId    Int
  invoiceId     Int?
  type          String   // DEBIT, CREDIT
  amountPaise   Int
  balanceAfterPaise Int
  ...
}
```

### Extended Models
- `Product`: Added `isTaxExempt`, `taxCategory`
- `Batch`: Added `purchaseGstRate`, `saleGstRateOverride`
- `Org`: Added GST settings fields
- `Customer`: Added credit fields
- `Invoice`: Added `supplyType`, `placeOfSupplyStateCode`, `eInvoicePayload`
- `InvoiceLineItem`: Added `mrpPaise`, `salePricePaise`, `gstRate`, `lineTotalPaise`
- `Payment`: Added `idempotencyKey`, `creditCustomerId`, status `INITIATED`

## 🚀 Setup Instructions

### 1. Run Database Migrations

```bash
cd pharmapulse-next
npx prisma migrate dev --name add_gst_billing_payments
npx prisma generate
```

### 2. Seed HSN Master Data (Optional)

Create a seed script or manually insert common HSN codes:

```sql
INSERT INTO hsn_master (id, hsn_code, description, default_gst_rate, gst_type, is_active)
VALUES 
  ('1', '3004', 'Medicaments (medicines)', 12.00, 'EXCLUSIVE', true),
  ('2', '3003', 'Medicaments for therapeutic or prophylactic uses', 12.00, 'EXCLUSIVE', true),
  ('3', '3002', 'Human blood; animal blood', 12.00, 'EXCLUSIVE', true);
```

### 3. Test the Features

1. **Cart Validation**:
   - Add items to cart
   - Click Checkout
   - See validation results (HSN missing, stock warnings, etc.)

2. **HSN Auto-Mapping**:
   - Add item without HSN
   - System suggests HSN based on rules
   - Use HSN quick-fix modal to confirm

3. **Invoice Preview**:
   - After validation, see invoice preview with tax breakup
   - Verify CGST/SGST for intra-state or IGST for inter-state

4. **Split Payments**:
   - In payment modal, add multiple payment methods
   - Validate sum equals total

5. **Credit Customers**:
   - Mark customer as credit customer
   - Select CREDIT payment method
   - System enforces credit limit

6. **GSTR-1 Export**:
   - Visit: `/api/reports/gstr1?from=2024-01-01&to=2024-12-31`
   - Download CSV file

## 🔒 Permission Enforcement

- **HSN Override**: Only Owner/Admin can set HSN codes
- **Checkout**: All roles checked (Intern/Trainee blocked)
- **GST Override**: Only Owner/Admin
- **Batch Change**: Pharmacist and above

## 📊 GST Calculation Flow

1. **Determine Supply Type**:
   - Compare seller state code with buyer state code
   - Same state → INTRA_STATE (CGST+SGST)
   - Different state → INTER_STATE (IGST)

2. **Get Effective GST Rate** (per line item):
   - Check batch `saleGstRateOverride` (if batch exists)
   - Else check product `gstRate`
   - Else check HSN master `defaultGstRate`
   - Else use 0

3. **Calculate Tax**:
   - Taxable value = price (or price / (1 + gstRate/100) if INCLUSIVE)
   - CGST = taxable * (gstRate/2) / 100 (if intra-state)
   - SGST = taxable * (gstRate/2) / 100 (if intra-state)
   - IGST = taxable * gstRate / 100 (if inter-state)

4. **Round Off**:
   - Apply Indian rounding rules
   - Adjust grand total

## 🧪 API Endpoints

### Cart Validation
```bash
POST /api/pos/validate-cart
Body: { lineItems, customerId }
Response: { valid, issues, warnings, totals, supplyType }
```

### Issue Invoice
```bash
POST /api/pos/issue-invoice
Body: { lineItems, customerId, payments, idempotencyKey }
Response: { invoice, payments }
```

### HSN Auto-Map
```bash
POST /api/hsn/auto-map
Body: { items: [{ productName, category, saltComposition, ... }] }
Response: { results: [{ suggestion }] }
```

### Set HSN (Admin)
```bash
POST /api/hsn/set
Body: { productId, drugLibraryId, hsnCode, gstRate }
Response: { product }
```

### GSTR-1 Export
```bash
GET /api/reports/gstr1?from=2024-01-01&to=2024-12-31
Response: CSV file download
```

## 🐛 Troubleshooting

1. **HSN not auto-mapping**: Check if HsnRule records exist and are enabled
2. **Wrong GST calculation**: Verify supply type (intra vs inter-state)
3. **Payment failure**: Check idempotency key to prevent duplicates
4. **Credit limit exceeded**: Verify customer creditLimit and currentCreditBalance
5. **Stock validation fails**: Ensure batch quantities are correct

## 📝 Next Steps

1. Populate HSN master with common medicine HSN codes
2. Create HSN rules for auto-mapping
3. Configure org GST settings (GSTIN, address, etc.)
4. Test with real invoice scenarios
5. Integrate with NIC e-invoice API (when ready)

## 🎯 Key Features

- ✅ **GST-Correct**: Accurate CGST/SGST/IGST calculation
- ✅ **Invoice-Ready**: Complete invoice preview before issuance
- ✅ **Payment-Robust**: Split, partial, credit payments with failure recovery
- ✅ **HSN Enforcement**: Auto-mapping with manual override
- ✅ **GSTR-1 Ready**: CSV export for tax filing
- ✅ **Role-Based**: Permission checks on all sensitive operations
- ✅ **Audit Logged**: All overrides and sensitive actions logged
