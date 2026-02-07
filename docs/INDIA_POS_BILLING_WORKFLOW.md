# India POS + Billing Workflow

## Overview
PharmaPulse POS system for Indian pharmacies with GST-compliant billing, barcode scanning, and thermal printing support.

## Sales Flow

### 1. Start Sale
- Navigate to `/pos` page
- System ready for scanning/searching products

### 2. Add Products
**Barcode Scanning (Recommended)**:
- Connect USB/Bluetooth barcode scanner (HID mode)
- Point scanner at product barcode (UPC/EAN)
- Product auto-added to cart
- Scanner sends data as keyboard input + Enter

**Manual Search**:
- Type product name or internal code (e.g., NMED-000001)
- Select from search results
- Click "Add" to add to cart

### 3. Cart Management
- Edit quantity, price, discount per item
- Remove items
- View HSN codes and GST rates

### 4. Customer Details
**B2C (Customer Sale)**:
- Customer name (required)
- Optional: phone, email, address

**B2B (Business Sale)**:
- Customer name
- **Buyer GSTIN** (15-character, required)
- Full address (recommended)
- Place of Supply (state code, required)

### 5. Discounts
- Global discount (amount or percentage)
- Coupon codes
- Per-item discounts

### 6. GST Calculation
- **Intra-state**: CGST + SGST (each = GST/2)
- **Inter-state**: IGST (full GST rate)
- Automatically determined by seller state vs. place of supply

### 7. Payment
Methods:
- **Cash**: Immediate payment
- **Card**: Card payment with transaction reference
- **UPI**: UPI QR code or UTR capture
- **Cheque**: Cheque number reference
- **Bank Transfer**: Transaction ID reference

### 8. Invoice Generation
- Invoice number generated automatically
- GST-compliant tax invoice created
- Receipt viewable at `/pos/receipt/[id]`
- Browser print (fallback) or thermal printer (recommended)

## GST Essentials

### Tax Inclusion
- **EXCLUSIVE**: Tax added on top of selling price
- **INCLUSIVE**: Price includes tax (taxable value calculated backwards)

### HSN Summary
- Grouped by HSN code and GST rate
- Shows taxable value, CGST/SGST/IGST breakdown

### Round-off
- Applied to final grand total
- Typically rounded to nearest rupee

## Invoice Requirements (India)

### Mandatory Fields
- Invoice number (sequential)
- Invoice date
- Seller GSTIN and state code
- Buyer details (name mandatory, GSTIN for B2B)
- Place of Supply (state code)
- HSN code for each item
- GST breakup (CGST/SGST/IGST)
- Grand total

### Optional Fields
- Buyer address, phone, email
- Payment terms
- Reference number (PO/order)
- Notes

## Price Management

### MRP vs. Selling Price
- **MRP**: Maximum Retail Price (regulatory)
- **Selling Price**: Actual sale price (can be ≤ MRP)
- System tracks both

### Discount Rules
- Cannot sell above MRP
- Discounts can be applied within MRP limit
- GST calculated on discounted amount

