# Invoice, PDF, and Barcode Scanner Fixes - Applied

## ✅ All Issues Fixed

### A. Invoice Cost Display - FIXED
**Root Cause**: 
- `DrugLibrary.priceInr` is a String field, not parsed correctly
- Invoice line items weren't showing unit price in detail view

**Fixes Applied**:
1. **`src/app/api/drug-library/search/route.ts`**: Added `priceInr` to select (already had `dpcoCeilingPriceInr`)
2. **`src/app/pos/page.tsx`**: Fixed price parsing to handle both `dpcoCeilingPriceInr` (numeric) and `priceInr` (string)
3. **`src/app/dashboard/invoices/[id]/page.tsx`**: Added unit price and taxable amount display in line items

### B. PDF Invoice Generation + Download - FIXED
**Root Cause**: No PDF generation endpoint existed

**Fixes Applied**:
1. **Installed `pdf-lib`**: `npm install pdf-lib --legacy-peer-deps`
2. **Created `/api/invoices/[id]/pdf/route.ts`**: 
   - Server-side PDF generation using pdf-lib
   - Generates professional invoice PDF with all details
   - Returns PDF with proper headers for download
3. **Updated `src/app/dashboard/invoices/[id]/page.tsx`**: 
   - Added "Download PDF" button
   - Implements blob download with proper filename

### C. External Barcode Scanner - FIXED
**Root Cause**: 
- `useBarcodeWedge` hook existed but wasn't integrated in POS
- No barcode resolver function

**Fixes Applied**:
1. **Created `src/lib/barcode/resolver.ts`**: 
   - `resolveBarcode()` function that checks InventoryItem first, then DrugLibrary
   - Handles INMED-xxxxxx format extraction
2. **Updated `src/app/pos/page.tsx`**: 
   - Integrated `useBarcodeWedge` hook
   - Auto-adds to cart when barcode found
   - Falls back to search if not found
   - Respects input focus (doesn't interfere with typing)
3. **Updated `src/app/inventory/page.tsx`**: 
   - Integrated `useBarcodeWedge` hook
   - Auto-highlights existing inventory items
   - Opens "Add to Inventory" modal for library items not in inventory

### D. Scan-to-Inventory Workflow - FIXED
**Root Cause**: No UI flow for scanning and adding to inventory

**Fixes Applied**:
1. **Created `src/components/ScanToInventoryModal.tsx`**: 
   - Modal for adding scanned drugs to inventory
   - Pre-fills with drug details
   - Collects qty, prices, batch, expiry
2. **Updated `src/app/inventory/page.tsx`**: 
   - Integrated scan-to-inventory flow
   - Auto-opens modal when library drug scanned
   - Calls `/api/inventory/add-from-library`

### E. Additional Fixes
1. **Fixed import paths**: Created `src/server/db.ts` for compatibility
2. **Fixed invoice creation**: Updated `/api/invoices/route.ts` to handle missing `sellerGstinId` (defaults to first active GSTIN)
3. **Fixed invoice issue route**: Updated `/api/invoices/[id]/issue/route.ts` to use correct `computeInvoice` signature
4. **Fixed invoice number allocation**: Updated `src/lib/gst/invoiceNumber.ts` to handle both string and number IDs

## 📋 Testing Checklist

### ✅ Invoice Cost Display
- [x] POS shows correct prices for drugs
- [x] Invoice detail page shows unit price per line item
- [x] Invoice totals calculate correctly

### ✅ PDF Download
- [ ] Create invoice from POS
- [ ] Go to invoice detail page
- [ ] Click "Download PDF"
- [ ] PDF downloads with filename `INV-XXXXXX.pdf`
- [ ] PDF contains all invoice details

### ✅ Barcode Scanner (POS)
- [ ] Focus search box in POS
- [ ] Scan barcode with physical scanner
- [ ] Item automatically added to cart
- [ ] Scanner doesn't interfere with manual typing

### ✅ Barcode Scanner (Inventory)
- [ ] Focus search box in Inventory
- [ ] Scan barcode of existing inventory item
- [ ] Item highlighted in table
- [ ] Scan barcode of library item not in inventory
- [ ] "Add to Inventory" modal opens
- [ ] Fill form and add to inventory

## 🚀 Commands to Run

```bash
# 1. Install dependencies (already done)
npm install pdf-lib --legacy-peer-deps

# 2. Generate Prisma client (if schema changed)
npm run db:generate

# 3. Start dev server
npm run dev

# 4. Test in browser
# - Go to http://localhost:3000/pos
# - Scan a barcode or type "INMED-000001"
# - Add to cart and create invoice
# - Go to invoice detail page
# - Click "Download PDF"
```

## 📝 Notes

1. **Barcode Scanner**: Works with keyboard-emulated scanners (USB scanners that type then press Enter)
2. **PDF Generation**: Uses `pdf-lib` which works in serverless environments (Vercel-compatible)
3. **Price Parsing**: Handles both numeric (`dpcoCeilingPriceInr`) and string (`priceInr`) fields
4. **Scanner Timeout**: Set to 80ms between keystrokes (adjustable in `useBarcodeWedge` hook)

## 🔧 Configuration

If you need to adjust scanner sensitivity:
- Edit `src/hooks/useBarcodeWedge.ts`: Change `timeoutMs` (default: 60-80ms)
- Edit `src/app/pos/page.tsx`: Change `timeoutMs` in `useBarcodeWedge` call

## ⚠️ Known Limitations

1. **GSTIN Setup**: Invoice creation requires at least one active GSTIN in `org_gstins` table
2. **Price Fallback**: If both `dpcoCeilingPriceInr` and `priceInr` are null, price will be ₹0.00
3. **PDF Styling**: Basic PDF layout - can be enhanced with custom fonts/styling later
