# GST-Compliant POS Terminal Implementation

## Overview
Complete implementation of GST-compliant POS Terminal for Indian tax filing, including HSN codes, GST calculations, invoice generation, PDF export, and GSTR-1 filing export.

## ✅ Completed Features

### 1. Database Schema Updates

**Product Model** (`prisma/schema.prisma`):
- `hsnCode String?` - HSN code (required in app, optional in DB for backward compatibility)
- `gstRate Decimal?` - GST rate percentage (e.g., 5.00, 12.00, 18.00)
- `gstType String` - "INCLUSIVE" or "EXCLUSIVE" (default: EXCLUSIVE)
- `barcode String?` - EAN/GTIN barcode

**Invoice Model**:
- `totalCGSTPaise Int` - Total CGST in paise
- `totalSGSTPaise Int` - Total SGST in paise
- `totalIGSTPaise Int` - Total IGST in paise
- `invoiceNumber String?` - FY-based format (PP/24-25/0001)

**InvoiceLineItem Model**:
- `hsnCode String?` - HSN code (required in app)
- `ean String?` - EAN/GTIN barcode
- `gstType String?` - INCLUSIVE or EXCLUSIVE
- `cgstPaise`, `sgstPaise`, `igstPaise` - Tax breakdown

### 2. Tax Calculation Utilities

**File**: `src/lib/gst/taxCalculator.ts`

- `calculateGst()` - Calculates GST for line items
  - GST INCLUSIVE: `taxable = price / (1 + gstRate/100)`
  - GST EXCLUSIVE: `taxable = price`
  - CGST = taxable * gstRate/2 / 100
  - SGST = taxable * gstRate/2 / 100
- `calculateInvoiceTotals()` - Aggregates totals for invoice
- Helper functions for formatting

**File**: `src/lib/gst/invoiceNumber.ts`

- `getCurrentFinancialYear()` - Returns FY format (24-25)
- `allocateInvoiceNumber()` - Generates FY-based invoice numbers
- Format: `PREFIX/FY/SEQUENCE` (e.g., PP/24-25/0001)

### 3. POS UI Enhancements

**File**: `src/app/pos/page.tsx`

**Cart Display**:
- Shows HSN code, GST%, and EAN for each item
- Expandable "Tax Breakdown" per item showing:
  - Taxable value
  - CGST (gstRate/2%)
  - SGST (gstRate/2%)
  - Line total

**Totals Footer**:
- Subtotal (Taxable)
- CGST total
- SGST total
- Grand Total

**Validation**:
- Blocks adding products without HSN or GST rate
- Shows warning banner for missing GST details
- Disables checkout if any item missing GST fields

**Component**: `src/components/pos/CartItemGstDetails.tsx`
- Reusable component for displaying GST details per cart item
- Expandable/collapsible tax breakdown

### 4. Checkout API

**File**: `src/app/api/pos/checkout/route.ts`

**Features**:
- Validates HSN and GST rate for all items
- Uses tax calculator for accurate GST computation
- Generates FY-based invoice numbers
- Creates invoice with CGST/SGST breakdown
- Deducts inventory with FIFO batch tracking
- Links to customer and prescription if provided
- Handles loyalty points

**Invoice Generation**:
- Auto-generates invoice number: `PP/24-25/0001`
- Stores all GST fields (HSN, EAN, CGST, SGST)
- Calculates totals using tax calculator
- Returns invoice ID for PDF generation

### 5. GST Invoice PDF Generator

**File**: `src/app/api/invoices/[id]/pdf/route.ts`

**Features**:
- A4 format PDF
- GST-compliant layout:
  - "TAX INVOICE" header
  - Seller GSTIN
  - Invoice number and date
  - Buyer details (with GSTIN if B2B)
  - Place of Supply
  - HSN table with columns:
    - Item, HSN, Qty, Rate, Taxable, CGST, SGST, Total
  - Totals breakdown:
    - Subtotal (Taxable)
    - CGST
    - SGST
    - Total GST
    - Grand Total
  - Payment method
  - QR code placeholder

**Endpoint**: `GET /api/invoices/:id/pdf`

### 6. GSTR-1 Export

**File**: `src/app/api/reports/gstr1/route.ts`

**Features**:
- Exports invoices in GSTR-1 format
- Supports CSV and JSON formats
- Date range filtering (`fromDate`, `toDate`)
- Includes all required fields:
  - Invoice number, date
  - Buyer GSTIN (if B2B)
  - Place of Supply
  - HSN code
  - Taxable value
  - CGST, SGST, IGST
  - Total tax and value

**Endpoint**: 
- `GET /api/reports/gstr1?format=csv&fromDate=2024-01-01&toDate=2024-12-31`
- `GET /api/reports/gstr1?format=json`

**Output Format**:
- CSV: Upload-ready for GST portal
- JSON: Includes summary totals

### 7. Validation & UX

**POS Validation**:
- ✅ Blocks adding products without HSN code
- ✅ Blocks adding products without GST rate
- ✅ Shows error message with product name
- ✅ Disables checkout button if GST details missing
- ✅ Warning banner lists all items with missing GST

**Success Flow**:
- ✅ Toast notification on invoice creation
- ✅ Success modal with invoice number
- ✅ "View Invoice" button
- ✅ "Download PDF" button (opens in new tab)
- ✅ "New Sale" button (clears cart and reloads)

## Files Created/Modified

### Created:
1. `src/lib/gst/taxCalculator.ts` - Tax calculation utilities
2. `src/lib/gst/invoiceNumber.ts` - Invoice number generation
3. `src/components/pos/CartItemGstDetails.tsx` - GST details component
4. `src/app/api/reports/gstr1/route.ts` - GSTR-1 export endpoint

### Modified:
1. `prisma/schema.prisma` - Product, Invoice, InvoiceLineItem models
2. `src/hooks/useCart.ts` - CartItem type with GST fields
3. `src/app/pos/page.tsx` - GST display, validation, tax totals
4. `src/app/api/pos/checkout/route.ts` - GST-compliant invoice generation
5. `src/app/api/invoices/[id]/pdf/route.ts` - Enhanced PDF with CGST/SGST

## Usage

### 1. Database Setup

```bash
# Sync schema (handles existing NULL values gracefully)
npm run db:sync

# Or manually:
npx prisma db push
npx prisma generate
```

### 2. Adding Products with GST

Products must have:
- `hsnCode` - HSN code (e.g., "3004" for medicines)
- `gstRate` - GST rate (e.g., 12.00 for 12%)
- `gstType` - "INCLUSIVE" or "EXCLUSIVE" (default: EXCLUSIVE)
- `barcode` - EAN/GTIN (optional)

### 3. POS Workflow

1. **Add Products**: Scan or search products
   - System validates HSN and GST rate
   - Shows error if missing

2. **View Cart**: 
   - See HSN, GST%, EAN for each item
   - Click "Tax Breakdown" to see CGST/SGST per item

3. **Checkout**:
   - Select customer (optional)
   - Choose payment method
   - System generates GST-compliant invoice
   - Invoice number: `PP/24-25/0001` format

4. **Download Invoice**:
   - Success modal appears
   - Click "Download PDF" for GST invoice
   - PDF includes all GST details

### 4. GSTR-1 Export

```bash
# CSV format (for GST portal upload)
GET /api/reports/gstr1?format=csv&fromDate=2024-01-01&toDate=2024-12-31

# JSON format (with summary)
GET /api/reports/gstr1?format=json&fromDate=2024-01-01&toDate=2024-12-31
```

## Tax Calculation Examples

### GST EXCLUSIVE (Default)
- Price: ₹100
- GST Rate: 12%
- Taxable: ₹100
- CGST: ₹6 (12% / 2)
- SGST: ₹6 (12% / 2)
- Total: ₹112

### GST INCLUSIVE
- Price: ₹112 (includes GST)
- GST Rate: 12%
- Taxable: ₹100 (112 / 1.12)
- CGST: ₹6
- SGST: ₹6
- Total: ₹112

## Testing

1. **Test Product Addition**:
   - Try adding product without HSN → Should show error
   - Try adding product without GST rate → Should show error
   - Add valid product → Should show HSN, GST%, EAN

2. **Test Tax Calculation**:
   - Add items with different GST rates
   - Verify CGST/SGST split (50/50)
   - Check totals match calculation

3. **Test Invoice Generation**:
   - Complete checkout
   - Verify invoice number format (PP/24-25/0001)
   - Download PDF and verify GST details

4. **Test GSTR-1 Export**:
   - Create multiple invoices
   - Export GSTR-1 CSV
   - Verify format matches GST portal requirements

## Important Notes

1. **Backward Compatibility**: 
   - `hsnCode` and `gstRate` are optional in schema (for existing data)
   - Validation enforced in application layer
   - Existing products without GST will show errors when added to cart

2. **Invoice Numbers**:
   - Format: `PREFIX/FY/SEQUENCE`
   - Financial year: April to March
   - Sequence resets per FY
   - Stored in `OrgGstin.nextInvoiceNo`

3. **GST Types**:
   - EXCLUSIVE: GST added on top of price (default)
   - INCLUSIVE: GST included in price

4. **Intra-state vs Inter-state**:
   - Currently defaults to intra-state (CGST+SGST)
   - IGST calculation ready for inter-state (future enhancement)

## Next Steps (Optional Enhancements)

1. **Inter-state Support**: 
   - Detect place of supply
   - Use IGST instead of CGST+SGST for inter-state

2. **GST Portal Integration**:
   - Direct upload to GST portal
   - E-way bill generation

3. **Advanced Reporting**:
   - GSTR-2, GSTR-3B exports
   - Tax liability reports
   - HSN-wise summary

---

**Implementation Date**: December 2024
**Status**: ✅ Complete and ready for testing


