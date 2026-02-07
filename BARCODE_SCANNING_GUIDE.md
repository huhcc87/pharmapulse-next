# Barcode Scanning Guide - EAN/HSN/INMED

## ✅ Fixed Error
The `ReferenceError: prev is not defined` has been fixed. The `useEffect` now properly uses `prev` inside the `setFormData` callback.

## How Barcode Scanning Works

### Supported Barcode Types

The system supports **3 types of barcodes**:

1. **EAN (European Article Number)**
   - **EAN13**: 13 digits (e.g., `8906000055717` - Raboserv-LP)
   - **EAN8**: 8 digits
   - **UPC**: 12 digits
   - **Format**: Just scan the barcode number

2. **HSN (Harmonized System of Nomenclature)**
   - **Format**: 4-8 digit code (e.g., `30049099` for medicines)
   - Used for GST tax classification
   - Can search products by HSN code

3. **INMED (Internal Medicine Code)**
   - **Format**: `INMED-000001` to `INMED-253973`
   - Internal QR codes for drug library
   - Links to DrugLibrary table

### Scanning Flow

```
Scan Barcode (Any Type)
    ↓
/api/products/by-barcode?code={barcode}
    ↓
Unified Lookup Service
    ├─→ EAN → Check Product.barcodeValue + barcodeTypeEnum
    ├─→ HSN → Check Product.hsnCode
    └─→ INMED → Check Product.internalCode OR DrugLibrary.qrCode
    ↓
Result:
    ├─→ Found in Inventory → Add to Cart ✅
    ├─→ Found in Drug Library → Add to Inventory First
    └─→ Not Found → Create New Product
```

### Where to Scan

#### 1. **POS Terminal** (`/pos`)
- **Best for**: Quick checkout, adding items to cart
- **How**: 
  - Click in search bar or enable "Barcode-first" mode
  - Scan any barcode (EAN/HSN/INMED)
  - Product automatically added to cart if found
  - If not found, shows "Link Barcode" modal with "Create New Product" option

#### 2. **Inventory Page** (`/inventory`)
- **Best for**: Adding new products to inventory
- **How**:
  - Click in search bar
  - Scan barcode
  - If found in inventory → Shows product details
  - If found in drug library → Shows "Add to Inventory" modal
  - If not found → Shows "Add Product" modal with barcode pre-filled

### Step-by-Step: Adding a New Drug

**Example: Raboserv-LP (EAN: 8906000055717)**

1. **Go to POS or Inventory**
   - POS: `http://localhost:3000/pos`
   - Inventory: `http://localhost:3000/inventory`

2. **Scan Barcode**
   - Point scanner at barcode `8906000055717`
   - Or type it in the search bar

3. **If Not Found**:
   - Modal opens: "Link Barcode to Product"
   - Click **"Create New Product with this Barcode"**

4. **Fill Product Details**:
   - **Product Name**: `Raboserv-LP` (from package label) ⚠️ **REQUIRED**
   - **Barcode**: `8906000055717` (pre-filled)
   - **Price**: `₹80.00` (from MRP on package)
   - **MRP**: `₹80.00`
   - **GST Rate**: `12%` (default for medicines)
   - **HSN Code**: `30049099` (or search drug library)
   - **Manufacturer**: `SEAGULL LABS`
   - **Composition**: `Rabeprazole Sodium + Levosulpiride`

5. **Save Product**
   - Product created in database
   - Automatically added to cart (if in POS)

6. **Next Scan**
   - Scan same barcode → Found! ✅
   - One click → Added to cart

### Tips for Best Results

1. **Always Enter Real Product Name**
   - Don't use generic names like "Medicine Product 055717"
   - Enter exact name from package: "Raboserv-LP", "Paracetamol 500mg", etc.

2. **Use Drug Library Search**
   - In "Add Product" modal, use "Search Drug Library" field
   - Can search by brand name, composition, or barcode
   - Auto-fills product details if found

3. **HSN Code Lookup**
   - Most medicines use HSN: `30049099` (12% GST)
   - Can search HSN master table
   - System suggests HSN based on product name

4. **Barcode Types**
   - **EAN13** (13 digits): Most retail products
   - **HSN** (4-8 digits): For GST classification
   - **INMED** (INMED-XXXXXX): Internal drug library codes

### Troubleshooting

**Problem**: Barcode not found
- **Solution**: Click "Create New Product" and enter details manually

**Problem**: Generic name "Medicine Product XXXX"
- **Solution**: Edit product and change name to actual product name

**Problem**: GST missing error
- **Solution**: Update product GST details via "Update GST" button

**Problem**: Product found but can't add to cart
- **Solution**: Check if HSN and GST are set. Update if missing.

### API Endpoints

- **Lookup**: `GET /api/products/by-barcode?code={barcode}`
  - Supports: EAN, HSN, INMED
  - Returns: `{ found: true/false, product: {...} }`

- **Create**: `POST /api/products`
  - Body: `{ name, barcode, price, mrp, gstRate, hsnCode, ... }`

- **Update**: `PUT /api/products/{id}`
  - Body: `{ name: "Raboserv-LP", ... }`

### Best Practices

1. ✅ **Scan in Inventory first** for new products
2. ✅ **Enter complete product details** (name, price, GST, HSN)
3. ✅ **Use Drug Library** to auto-fill details when possible
4. ✅ **Verify product name** matches package label
5. ✅ **Set correct GST rate** (usually 12% for medicines)

---

**The system now works with ANY barcode type (EAN/HSN/INMED) - just scan and it will automatically detect the type!**
