# Drug Library Integration - Setup Guide

## Overview
This guide explains how to set up and use the India Drug Library with 253,973 medicines in your PharmaPulse application.

## Database Schema

### Tables Created
1. **drug_library** - Master dataset of 253,973 Indian medicines
2. **inventory_items** - Tenant + branch scoped inventory items referencing drug_library
3. **audit_log** - Audit trail for all inventory operations

### Key Features
- Normalized search columns for fast fuzzy matching
- Multi-tenant + branch scoping
- Audit logging for all mutations
- Proper indexes for performance

## Setup Steps

### 1. Database Migration
```bash
cd pharmapulse-next
npx prisma db push
npx prisma generate
```

### 2. Import Drug Library Data
```bash
# Ensure CSV file is in the correct location:
# Drugs list/2) Clean CSV for database import-A_Z_medicines_dataset_of_India_clean (1).csv

# Or set environment variable:
export DRUG_CSV_PATH="/path/to/your/csv/file.csv"

# Run import
npm run db:import-drug-library
```

The import script will:
- Read the CSV file
- Normalize text fields for search
- Import all 253,973 medicines
- Verify import by searching for "Crocin"

### 3. Verify Import
After import, verify the data:

```sql
-- Check total count
SELECT COUNT(*) FROM drug_library;

-- Search for Crocin
SELECT id, brand_name, manufacturer, salts, price_inr 
FROM drug_library 
WHERE brand_name LIKE '%Crocin%' 
  AND is_discontinued = 0 
LIMIT 10;

-- Check normalized columns
SELECT brand_name, brand_name_norm 
FROM drug_library 
WHERE brand_name_norm LIKE '%crocin%' 
LIMIT 5;
```

## API Endpoints

### 1. Search Drug Library
```
GET /api/drug-library/search?q={query}&limit={limit}&offset={offset}
```

**Example:**
```bash
curl "http://localhost:3000/api/drug-library/search?q=Crocin&limit=10"
```

**Response:**
```json
{
  "results": [
    {
      "id": 12345,
      "brandName": "Crocin Advance Tablet",
      "manufacturer": "GlaxoSmithKline Consumer Healthcare",
      "priceInr": 22.62,
      "isDiscontinued": false,
      "category": "Tablet",
      "packSize": "strip of 20 tablets",
      "fullComposition": "Paracetamol (500mg)",
      "salts": "Paracetamol",
      "gstPercent": 12.0,
      "schedule": null,
      "rxOtc": "OTC",
      "score": 100,
      "matchReason": "Brand name match"
    }
  ],
  "total": 15,
  "limit": 10,
  "offset": 0
}
```

### 2. Add to Inventory
```
POST /api/inventory/add-from-library
```

**Request Body:**
```json
{
  "drugLibraryId": 12345,
  "qtyOnHand": 100,
  "reorderLevel": 10,
  "expiryDate": "2025-12-31T00:00:00Z",
  "purchasePrice": 18.50,
  "sellingPrice": 22.00,
  "batchCode": "BATCH001",
  "tenantId": 1,
  "branchId": 1,
  "userId": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Drug added to inventory successfully",
  "inventoryItem": {
    "id": 1,
    "drugLibraryId": 12345,
    "brandName": "Crocin Advance Tablet",
    "manufacturer": "GlaxoSmithKline Consumer Healthcare",
    "qtyOnHand": 100,
    "reorderLevel": 10,
    "expiryDate": "2025-12-31T00:00:00Z",
    "purchasePrice": 18.50,
    "sellingPrice": 22.00,
    "batchCode": "BATCH001",
    "category": "Tablet",
    "packSize": "strip of 20 tablets",
    "priceInr": 22.62
  }
}
```

## UI Usage

### 1. Search Drug Library
- Click "Drug Library" button in Inventory page
- Type to search (minimum 2 characters)
- Results show: brand name, manufacturer, salts, composition, pack size, price
- Click "Add to Inventory" to add selected drug

### 2. Search Features
- **Brand name search**: Exact, prefix, and contains matching
- **Salt search**: Search by active ingredients
- **Composition search**: Full composition text search
- **Manufacturer search**: Search by manufacturer name
- **Normalized search**: Handles variations in spelling/punctuation

## Verification Queries

### Check if Crocin exists
```sql
SELECT 
  id,
  brand_name,
  manufacturer,
  salts,
  full_composition,
  pack_size,
  price_inr,
  is_discontinued
FROM drug_library
WHERE 
  (brand_name LIKE '%Crocin%' OR brand_name_norm LIKE '%crocin%')
  AND is_discontinued = 0
ORDER BY brand_name
LIMIT 10;
```

### Check search indexes
```sql
-- SQLite doesn't support pg_trgm, but we use LIKE with indexes
-- Check if indexes exist
SELECT name FROM sqlite_master 
WHERE type='index' 
  AND tbl_name='drug_library';
```

### Check inventory items
```sql
SELECT 
  ii.id,
  ii.qty_on_hand,
  ii.reorder_level,
  dl.brand_name,
  dl.manufacturer
FROM inventory_items ii
JOIN drug_library dl ON ii.drug_library_id = dl.id
WHERE ii.tenant_id = 1
LIMIT 10;
```

## Troubleshooting

### Import fails
- Check CSV file path
- Verify CSV format matches expected columns
- Check database connection
- Review error logs

### Search returns no results
- Verify data was imported: `SELECT COUNT(*) FROM drug_library;`
- Check if search query is at least 2 characters
- Try searching for common brands like "Crocin", "Dolo", "Paracetamol"

### Add to inventory fails
- Verify tenant_id and branch_id are provided
- Check if drug exists: `SELECT * FROM drug_library WHERE id = ?`
- Check if drug is discontinued
- Review audit_log for error details

## Files Changed

1. **prisma/schema.prisma** - Added DrugLibrary, InventoryItem, AuditLog models
2. **prisma/import-drug-library.ts** - Import script with normalization
3. **src/app/api/drug-library/search/route.ts** - Fast search API
4. **src/app/api/inventory/add-from-library/route.ts** - Add to inventory endpoint
5. **src/components/DrugLibraryModal.tsx** - Updated UI (removed MIMS references)
6. **src/app/inventory/page.tsx** - Updated to use new API

## Next Steps

1. Import the drug library data
2. Test search functionality
3. Test add-to-inventory functionality
4. Configure tenant_id and branch_id from session/auth
5. Set up proper RBAC for inventory operations

