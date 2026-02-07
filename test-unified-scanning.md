# Test Unified Barcode Scanning - Example

## 🧪 **Test Product Setup**

### **Step 1: Create Test Product**

Run this SQL in your database (or use Prisma Studio):

```sql
-- Test Product: Paracetamol 500mg Tablet
-- EAN: 8901234567890
-- HSN: 3004
INSERT INTO "Product" (
  "sku", "name", "category", "manufacturer",
  "barcodeTypeEnum", "barcodeValue", "hsnCode",
  "gstRate", "gstType", "salePrice", "unitPrice", "mrp",
  "stockLevel", "minStock", "isActive", "createdAt", "updatedAt"
) VALUES (
  'TEST-PARA-001',
  'Paracetamol 500mg Tablet',
  'Analgesic',
  'ABC Pharmaceuticals',
  'EAN13',
  '8901234567890',
  '3004',
  12.00,
  'EXCLUSIVE',
  25.00,
  20.00,
  30.00,
  100,
  10,
  true,
  NOW(),
  NOW()
);
```

### **Step 2: Test Scenarios**

#### **Test 1: Scan EAN Code**
1. Go to POS page (`/pos`)
2. Enable "Barcode-first" mode (toggle button)
3. Scan or type: `8901234567890`
4. **Expected Result:**
   - ✅ Product found: "Paracetamol 500mg Tablet"
   - ✅ Added to cart with quantity 1
   - ✅ Green confirmation popup appears (top-right)
   - ✅ Success toast: "Item added: Paracetamol 500mg Tablet"
   - ✅ Beep sound plays
   - ✅ Search field auto-focused and ready for next scan

#### **Test 2: Scan HSN Code**
1. Clear cart if needed
2. Scan or type: `3004` (HSN code)
3. **Expected Result:**
   - ✅ Product found by HSN code
   - ✅ Added to cart
   - ✅ Confirmation popup shown

#### **Test 3: Adjust Quantity**
1. After scanning, use +/- buttons in confirmation popup
2. **Expected Result:**
   - ✅ Quantity updates in real-time
   - ✅ Price recalculates automatically
   - ✅ Cart reflects new quantity

#### **Test 4: Remove Item**
1. Click "Remove" button in confirmation popup
2. **Expected Result:**
   - ✅ Item removed from cart
   - ✅ Popup disappears
   - ✅ Search field ready for next scan

#### **Test 5: Product Not Found**
1. Scan non-existent barcode: `9999999999999`
2. **Expected Result:**
   - ⚠️ "Item not found" message
   - ⚠️ Bind barcode modal opens
   - ⚠️ Option to add product to inventory

#### **Test 6: Inventory Integration**
1. Go to Inventory page (`/inventory`)
2. Scan same EAN: `8901234567890`
3. **Expected Result:**
   - ✅ Product found and displayed
   - ✅ Can view/edit product details
   - ✅ Can add stock

#### **Test 7: Checkout & Invoice**
1. Add product to cart (via EAN or HSN scan)
2. Click "Checkout"
3. Complete payment
4. **Expected Result:**
   - ✅ Invoice generated with:
     - HSN code: `3004`
     - GST rate: `12%`
     - CGST/SGST breakdown
   - ✅ Stock decremented (100 → 99)
   - ✅ PDF invoice available for download

---

## 📋 **Verification Checklist**

- [ ] EAN scan works (13 digits)
- [ ] HSN scan works (4-8 digits)
- [ ] INMED scan works (INMED-000001 format)
- [ ] Auto-add to cart (quantity 1)
- [ ] Inline confirmation popup appears
- [ ] Quantity adjustment works (+/-)
- [ ] Remove button works
- [ ] Auto-focus returns to search field
- [ ] Visual feedback (blue border, "Ready" indicator)
- [ ] Success toast and beep sound
- [ ] Product not found → Bind modal opens
- [ ] Inventory page uses same lookup
- [ ] Stock auto-decrements on checkout
- [ ] Invoice PDF includes HSN and GST breakdown

---

## 🎯 **Expected Behavior Summary**

### **One-Scan, One-Click Workflow:**
1. **Scan** → Barcode detected (EAN/HSN/INMED)
2. **Lookup** → Product found via unified service
3. **Add** → Automatically added to cart (qty: 1)
4. **Confirm** → Inline popup with adjustment options
5. **Continue** → Auto-focus ready for next scan

### **Visual Feedback:**
- ✅ Blue border on search field (barcode-first mode)
- ✅ Pulsing "Ready" indicator
- ✅ Green confirmation popup (top-right)
- ✅ Success toast notification
- ✅ Beep sound on successful scan

### **GST Compliance:**
- ✅ HSN code stored and displayed
- ✅ GST rate auto-calculated
- ✅ Invoice PDF includes HSN table
- ✅ CGST/SGST breakdown shown

---

## 🐛 **Troubleshooting**

### **Product Not Found:**
- Check if product exists in database
- Verify barcode format (EAN: 8/12/13 digits, HSN: 4-8 digits)
- Check if product is active (`isActive = true`)

### **GST Missing:**
- Product must have `hsnCode` and `gstRate`
- Update GST modal will appear if missing
- Add HSN code and GST rate before checkout

### **Stock Not Updating:**
- Check checkout API logs
- Verify stock decrement logic in `/api/pos/checkout`
- Check database for stock level changes

---

**Test Status**: ✅ Ready for Testing
