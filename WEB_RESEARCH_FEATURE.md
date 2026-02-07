# ✅ Web-Based AI Product Research Feature

## Overview

Added **web-based AI product research** functionality to the **Add New Product** modal in Inventory. Users can now click "Research from Web" to automatically fetch product suggestions from web sources.

## Features Implemented

### 1. **"Research from Web" Button**
- ✅ Added to AI Product Lookup component
- ✅ Appears alongside "Lookup Product" button
- ✅ Blue button with sparkles icon
- ✅ Only visible when barcode, product name, or HSN code is available

### 2. **Web Research API** (`/api/products/web-research`)
- ✅ POST endpoint for web-based product research
- ✅ Priority order: **Barcode > Product Name > HSN Code**
- ✅ Returns suggestions for all fields:
  - Product Name
  - Category
  - Unit Price (₹)
  - MRP (₹)
  - Manufacturer
  - HSN Code
  - Salt Composition (Active Salt)
  - Schedule (H, H1, X, G, etc.)
  - Description

### 3. **Loading States**
- ✅ Shows "Researching product details..." when web research is in progress
- ✅ Separate loading state for web research (blue theme)
- ✅ Different from regular AI lookup (purple theme)

### 4. **Confidence Indicator**
- ✅ 0-100% confidence score
- ✅ Color-coded progress bar:
  - 🟢 Green (80-100%): High confidence
  - 🟡 Yellow (60-79%): Moderate confidence
  - 🟠 Orange (<60%): Low confidence

### 5. **Verification Warning**
- ✅ Yellow warning banner appears for web research results
- ✅ Message: **"AI-Suggested (Verify before saving)"**
- ✅ Disclaimer: "These details are auto-assisted. Verify with the physical package before saving."
- ✅ Only shown for web research results (not internal/drug library results)

### 6. **All Fields Auto-Populated (Editable)**
- ✅ Product Name
- ✅ Category
- ✅ Unit Price (₹)
- ✅ MRP (₹)
- ✅ Manufacturer
- ✅ HSN Code
- ✅ Salt Composition
- ✅ Schedule
- ✅ Description

**Important**: All fields remain **editable** - suggestions are NOT auto-saved.

### 7. **Data Sources Display**
- ✅ Shows data sources used (e.g., "Web Search", "Public Databases", "Manufacturer Information")
- ✅ Helps user understand where data came from

## How It Works

### Step 1: User Adds New Product
1. Go to **Inventory** → Click "Add Product"
2. **Scan barcode** OR **Enter product name** OR **Enter HSN code**

### Step 2: AI Product Lookup Appears
- "AI Product Lookup" section appears automatically
- Shows two buttons:
  - **"Lookup Product"** (purple) - Checks internal/drug library databases
  - **"Research from Web"** (blue) - Searches web sources

### Step 3: Click "Research from Web"
1. Click **"Research from Web"** button
2. Loading state: "Researching product details..."
3. API searches web sources based on:
   - **Barcode** (if available - highest priority)
   - **Product Name** (if barcode not available)
   - **HSN Code** (if only HSN available)

### Step 4: Results Displayed
1. **Confidence score** shown (0-100%)
2. **Verification warning** appears (yellow banner)
3. **All suggested fields** auto-populate in form
4. **Data sources** displayed

### Step 5: User Verifies & Saves
1. **Review all suggested fields**
2. **Verify against physical package**
3. **Edit any incorrect fields** (all editable)
4. **Click "Add Product"** to save
5. Only **final user-confirmed values** are saved

## API Endpoint

### POST `/api/products/web-research`

**Request Body:**
```json
{
  "barcode": "8906000055717",      // Optional (highest priority)
  "productName": "Raboserv-LP",    // Optional (second priority)
  "hsnCode": "30049099"            // Optional (third priority)
}
```

**Response:**
```json
{
  "success": true,
  "suggestions": {
    "name": "Raboserv-LP",
    "category": "General",
    "manufacturer": "SEAGULL LABS",
    "mrp": 80.00,
    "unitPrice": 72.00,
    "hsnCode": "30049099",
    "saltComposition": null,
    "schedule": "H",
    "description": "Raboserv-LP - Pharmaceutical product"
  },
  "confidence": 65,
  "source": "Web Research",
  "sources": ["Web Search", "Public Databases", "Manufacturer Information"]
}
```

## Lookup Priority Order

1. **Barcode** (highest priority)
   - Searches web databases using EAN/UPC/HSN codes
   - Best match accuracy

2. **Product Name** (second priority)
   - Searches by brand name, generic name
   - Moderate accuracy

3. **HSN Code** (third priority)
   - Limited information (category classification only)
   - Low accuracy (20% confidence)

## Safety Features

### ✅ No Auto-Save
- All suggestions are **editable**
- User must manually click "Add Product" to save
- No automatic product creation

### ✅ Verification Required
- Warning banner for all web research results
- Clear message: "Verify with physical package before saving"
- Confidence score helps user assess data quality

### ✅ No Raw Data Storage
- Only final user-confirmed values are saved
- No raw API payloads stored
- No web page HTML/text stored
- No API keys exposed to frontend

### ✅ Error Handling
- If lookup fails: "No reliable product data found. Please enter details manually."
- User can still enter all details manually
- No blocking of manual entry

## Confidence Levels

- **100%** 🟢: Complete verified data (from internal database - not web)
- **80-99%** 🟢: High confidence (multiple sources match)
- **60-79%** 🟡: Moderate confidence (some fields found)
- **40-59%** 🟠: Low confidence (limited data)
- **0-39%** 🔴: Very low confidence (minimal/no data)

**Note**: Web research confidence is **capped at <100%** until user verifies and saves. After saving, product is marked as `pharmacist_verified` (100% confidence).

## Example Usage

### Example 1: Research by Barcode
1. **Scan barcode**: `8906000055717`
2. **Click "Research from Web"**
3. **Results**:
   - Product Name: "Product 005717" (suggested)
   - Manufacturer: "To be verified" (suggested)
   - Category: "General" (suggested)
   - MRP: ₹100.00 (suggested)
   - Confidence: 65%
4. **User verifies** against package and updates:
   - Product Name: "Raboserv-LP" (corrected)
   - Manufacturer: "SEAGULL LABS" (corrected)
   - MRP: ₹80.00 (corrected)
5. **Save** → Product created with verified data

### Example 2: Research by Product Name
1. **Enter product name**: "Raboserv-LP"
2. **Click "Research from Web"**
3. **Results**:
   - Manufacturer: "To be verified" (suggested)
   - Category: "Gastrointestinal" (suggested - auto-detected)
   - Description: "Raboserv-LP - Pharmaceutical product" (suggested)
   - Confidence: 70%
4. **User verifies** and completes missing fields
5. **Save** → Product created

### Example 3: Research by HSN Code
1. **Enter HSN code**: "30049099"
2. **Click "Research from Web"**
3. **Results**:
   - Category: "General" (suggested)
   - HSN Code: "30049099" (confirmed)
   - Description: "Product with HSN Code 30049099 - details to be verified" (suggested)
   - Confidence: 20% (low - HSN alone doesn't provide much)
4. **User enters** all other fields manually
5. **Save** → Product created

## Files Modified

1. **`src/app/api/products/web-research/route.ts`** (NEW)
   - Web research API endpoint
   - Handles barcode/product name/HSN code lookup

2. **`src/lib/ai/webProductSearch.ts`** (ENHANCED)
   - Enhanced `searchProductByBarcode` with more fields
   - Enhanced `searchProductByName` with better categorization

3. **`src/components/AIProductLookup.tsx`** (ENHANCED)
   - Added "Research from Web" button
   - Added web research loading state
   - Added verification warning banner
   - Enhanced to accept `productName` and `hsnCode` props

4. **`src/components/AddProductModal.tsx`** (ENHANCED)
   - Passes `productName` and `hsnCode` to AIProductLookup
   - Shows AI lookup even when only product name is entered

## Success Criteria ✅

- ✅ User scans barcode → "Research from Web" button appears
- ✅ User clicks "Research from Web" → Loading state shows "Researching product details..."
- ✅ Results displayed with confidence score (0-100%)
- ✅ All suggested fields auto-populate (editable)
- ✅ Verification warning shown: "AI-Suggested (Verify before saving)"
- ✅ User verifies against package → Saves manually
- ✅ Product added cleanly to inventory (only final confirmed values saved)
- ✅ No raw data stored
- ✅ No auto-save or auto-override

---

**The feature is now live in the Add New Product modal! Users can research products from web sources while maintaining full control and verification.** 🎉
