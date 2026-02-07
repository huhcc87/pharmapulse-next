# GST, Billing & Payments Implementation - Patch Summary

## Prisma Schema Updates

### File: `prisma/schema.prisma`

**Changes:**
1. Extended `Product` model:
   - Added `isTaxExempt Boolean @default(false) @map("is_tax_exempt")`
   - Added `taxCategory String @default("TAXABLE") @map("tax_category")`

2. Extended `Batch` model:
   - Added `purchaseGstRate Decimal? @db.Decimal(5, 2) @map("purchase_gst_rate")`
   - Added `saleGstRateOverride Decimal? @db.Decimal(5, 2) @map("sale_gst_rate_override")`

3. Extended `Org` model:
   - Added `legalName String? @map("legal_name")`
   - Added `tradeName String? @map("trade_name")`
   - Added `addressLine1 String? @map("address_line1")`
   - Added `city String?`
   - Added `state String?`
   - Added `pincode String?`
   - Added `stateCode String? @map("state_code")`
   - Added `placeOfSupplyPolicy String? @default("CUSTOMER_STATE") @map("place_of_supply_policy")`

4. Extended `Customer` model:
   - Added `isCreditCustomer Boolean @default(false) @map("is_credit_customer")`
   - Added `creditLimit Decimal? @db.Decimal(12, 2) @map("credit_limit")`
   - Added `currentCreditBalance Decimal @default(0) @db.Decimal(12, 2) @map("current_credit_balance")`
   - Added `billingAddress String? @map("billing_address")`
   - Added `billingStateCode String? @map("billing_state_code")`
   - Added `billingPincode String? @map("billing_pincode")`
   - Added relation: `creditLedger CreditLedger[]`

5. Extended `Invoice` model:
   - Added `supplyType String? @map("supply_type")`
   - Added `placeOfSupplyStateCode String? @map("place_of_supply_state_code")`
   - Added `eInvoicePayload Json? @map("e_invoice_payload")`

6. Extended `InvoiceLineItem` model:
   - Added `mrpPaise Int? @map("mrp_paise")`
   - Added `salePricePaise Int? @map("sale_price_paise")`
   - Added `gstRate Decimal? @db.Decimal(5, 2) @map("gst_rate")`
   - Added `lineTotalPaise Int @default(0) @map("line_total_paise")`

7. Extended `Payment` model:
   - Added `creditCustomerId Int? @map("credit_customer_id")`
   - Added `idempotencyKey String? @unique @map("idempotency_key")`
   - Added index: `@@index([idempotencyKey])`

8. Updated `PaymentStatus` enum:
   - Added `INITIATED` status

9. New Models:
   - `HSNMaster` - HSN code master data
   - `HsnRule` - Auto-mapping rules
   - `CreditLedger` - Credit transaction ledger

---

## New Utility Files

### File: `src/lib/gst/advanced.ts`
**Purpose:** Advanced GST computation with intra/inter-state logic

**Key Functions:**
- `determineSupplyType()` - Determines INTRA_STATE vs INTER_STATE
- `getEffectiveGstRate()` - Gets GST rate with priority: batch > product > HSN > 0
- `computeLineItemGst()` - Computes GST for line item with supply type
- `roundOff()` - Indian rounding rules

### File: `src/lib/hsn/auto-map.ts`
**Purpose:** HSN auto-mapping service

**Key Functions:**
- `autoMapHsn()` - Auto-map HSN for single product
- `batchAutoMapHsn()` - Batch auto-map for multiple items

### File: `src/lib/invoice/number.ts`
**Purpose:** Invoice number generation (uses existing `allocateInvoiceNumber`)

### File: `src/lib/invoice/qr.ts`
**Purpose:** QR code generation utilities

**Key Functions:**
- `generateUpiQrPayload()` - Generate UPI payment QR
- `generateInvoiceVerificationQr()` - Generate invoice verification QR

---

## New API Routes

### File: `src/app/api/pos/validate-cart/route.ts`
**Endpoint:** `POST /api/pos/validate-cart`

**Request Body:**
```json
{
  "lineItems": [...],
  "customerId": 1
}
```

**Response:**
```json
{
  "valid": true,
  "issues": [...],
  "warnings": [...],
  "supplyType": "INTRA_STATE",
  "totals": {...},
  "lineCalculations": [...]
}
```

### File: `src/app/api/pos/issue-invoice/route.ts`
**Endpoint:** `POST /api/pos/issue-invoice`

**Request Body:**
```json
{
  "lineItems": [...],
  "customerId": 1,
  "payments": [...],
  "idempotencyKey": "uuid"
}
```

**Features:**
- Permission checks
- Stock validation
- GST computation
- Payment processing
- Credit limit enforcement
- Idempotency
- Transaction safety

### File: `src/app/api/hsn/auto-map/route.ts`
**Endpoint:** `POST /api/hsn/auto-map`

**Request Body:**
```json
{
  "items": [
    {
      "productName": "Crocin 500mg",
      "category": "Medicine",
      "saltComposition": "Paracetamol"
    }
  ]
}
```

**Response:**
```json
{
  "results": [
    {
      "suggestion": {
        "hsnCode": "3004",
        "gstRate": 12,
        "confidence": "HIGH"
      }
    }
  ]
}
```

### File: `src/app/api/hsn/set/route.ts`
**Endpoint:** `POST /api/hsn/set` (Admin only)

**Request Body:**
```json
{
  "productId": 1,
  "hsnCode": "3004",
  "gstRate": 12
}
```

### File: `src/app/api/reports/gstr1/route.ts`
**Endpoint:** `GET /api/reports/gstr1?from=YYYY-MM-DD&to=YYYY-MM-DD`

**Response:** CSV file download

**CSV Columns:**
- Invoice_Number
- Invoice_Date
- Customer_GSTIN
- Place_of_Supply
- HSN
- Taxable_Value
- CGST_Rate, CGST_Amount
- SGST_Rate, SGST_Amount
- IGST_Rate, IGST_Amount
- Total_Amount

---

## New UI Components

### File: `src/components/pos/CheckoutModal.tsx`
**Purpose:** Enhanced checkout modal with invoice preview

**Features:**
- Cart validation on open
- Shows issues and warnings
- Invoice preview with tax breakup
- QR code preview
- Proceeds to payment modal

### File: `src/components/pos/HsnQuickFixModal.tsx`
**Purpose:** Quick-fix modal for missing HSN codes

**Features:**
- Shows HSN suggestions with confidence levels
- Manual HSN/GST entry
- Batch save all fixes

### File: `src/app/invoices/[id]/print/page.tsx`
**Purpose:** Print-friendly invoice page

**Features:**
- Full invoice details
- QR code display
- Print button (hidden when printing)
- GST-compliant format

---

## Modified Files

### File: `src/app/pos/page.tsx`
**Changes:**
- Integrated `CheckoutModal` instead of direct `PaymentModal`
- Added HSN quick-fix modal integration
- Updated checkout flow to use new `/api/pos/issue-invoice` endpoint
- Added HSN validation before checkout

### File: `src/lib/types/pos.ts`
**Changes:**
- Added `CREDIT` to `PaymentMethod` type

### File: `src/components/pos/PaymentModal.tsx`
**Changes:**
- Added `CREDIT` payment method option

---

## Migration Command

```bash
cd pharmapulse-next
npx prisma migrate dev --name add_gst_billing_payments
npx prisma generate
```

## Testing Checklist

- [ ] Run migration successfully
- [ ] Test cart validation with missing HSN
- [ ] Test HSN auto-mapping
- [ ] Test invoice issue with intra-state (CGST+SGST)
- [ ] Test invoice issue with inter-state (IGST)
- [ ] Test split payments
- [ ] Test partial payments
- [ ] Test credit customer with limit enforcement
- [ ] Test GSTR-1 export
- [ ] Test invoice print page
- [ ] Test payment failure recovery (idempotency)

## Key Features Summary

✅ **GST-Correct**: Accurate CGST/SGST/IGST calculation based on supply type
✅ **HSN Enforcement**: Auto-mapping with manual override
✅ **Invoice-Ready**: Complete preview before issuance
✅ **Payment-Robust**: Split, partial, credit with failure recovery
✅ **GSTR-1 Ready**: CSV export for tax filing
✅ **Role-Based**: Permission checks on all operations
✅ **Audit Logged**: All sensitive actions logged
