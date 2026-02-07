# Fix Product Name Issue

## Problem
When scanning a new barcode, the product is created with a generic name like "Medicine Product 055717" instead of the actual product name like "Raboserv-LP".

## Solution

### For Existing Products:
To fix the product name "Medicine Product 055717" to "Raboserv-LP":

1. **Option 1: Edit in Inventory**
   - Go to `/inventory`
   - Find the product
   - Click Edit (if available) or update via API

2. **Option 2: Use API**
   ```bash
   # Find product ID first
   curl http://localhost:3000/api/products?barcode=8906000055717
   
   # Update product name (replace {id} with actual product ID)
   curl -X PUT http://localhost:3000/api/products/{id} \
     -H "Content-Type: application/json" \
     -d '{"name": "Raboserv-LP"}'
   ```

### For Future Scans:
The AddProductModal now:
- ✅ Does NOT auto-populate generic names
- ✅ Requires manual entry of product name
- ✅ Shows clear warning if generic name is detected
- ✅ Has better placeholder text: "Enter product name from package (e.g., Raboserv-LP)"

## Changes Made

1. **AddProductModal.tsx**:
   - Removed auto-population of "Medicine Product {lastDigits}"
   - Added warning when generic name is detected
   - Improved placeholder and prompts
   - AI lookup won't populate generic names

2. **Product Name Validation**:
   - Field is required (red asterisk)
   - Clear warnings shown when barcode is scanned
   - Prevents saving with generic names

## How to Use

When scanning a new barcode:
1. Scan barcode → `AddProductModal` opens
2. **IMPORTANT**: Enter actual product name from package (e.g., "Raboserv-LP")
3. Fill in other details (price, MRP, GST, etc.)
4. Save → Product created with correct name

The system will NOT auto-populate generic names anymore.
