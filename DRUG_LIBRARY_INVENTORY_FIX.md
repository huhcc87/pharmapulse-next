# Drug Library → Inventory Integration Fix

## Problem
Adding drugs from Drug Library to inventory fails with:
```
"The column inventory_items.mrp does not exist in the current database."
```

## Solution

### 1. SQL Migration File
**File:** `prisma/migrations/add_mrp_to_inventory_items.sql`

This migration:
- Adds `mrp NUMERIC(10,2)` column to `inventory_items` table
- Backfills existing rows: sets `mrp = selling_price` where available, then `purchase_price`

### 2. Schema Update
**File:** `prisma/schema.prisma`

Updated `InventoryItem` model:
```prisma
mrp Decimal? @db.Numeric(10, 2)
```

### 3. Code Updates
**Files:**
- `src/app/api/inventory/add-from-library/route.ts`
- `src/app/api/inventory/add-from-qr/route.ts`

**Changes:**
- Added `calculateMrp()` helper function
- MRP is calculated from: `sellingPrice` → `dpcoCeilingPriceInr` → `priceInr` → `purchasePrice`
- MRP is set when creating/updating inventory items
- Queries do NOT filter on `mrp` - they use `(tenantId, branchId, drugLibraryId, batchCode)`

### 4. Dev-Only Startup Check
**Files:**
- `src/lib/db/schema-check.ts` - Schema validation utility
- `src/app/api/admin/schema-check/route.ts` - API endpoint
- `src/components/admin/SchemaWarningBanner.tsx` - Admin banner component
- `src/app/layout.tsx` - Added banner to root layout

The banner shows: **"Run migration add_mrp_to_inventory_items.sql"** if the column is missing.

## Exact Commands to Run

```bash
# 1. Run the SQL migration in your database
# Option A: Using Supabase SQL Editor
# - Open Supabase project → SQL Editor
# - Copy/paste contents of: prisma/migrations/add_mrp_to_inventory_items.sql
# - Execute

# Option B: Using psql
psql $DATABASE_URL -f prisma/migrations/add_mrp_to_inventory_items.sql

# 2. (Optional) Pull schema from database to sync
npx prisma db pull

# 3. Regenerate Prisma Client
npx prisma generate

# 4. Restart your server
npm run dev
# OR
npm start
```

## Verification

### Check Migration Status
```sql
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'inventory_items' 
  AND column_name = 'mrp';
```

### Check via API (dev only)
```bash
curl http://localhost:3000/api/admin/schema-check
```

Expected response:
```json
{
  "columnExists": true,
  "message": "Column inventory_items.mrp exists ✓"
}
```

## Files Changed

1. ✅ `prisma/migrations/add_mrp_to_inventory_items.sql` - SQL migration
2. ✅ `prisma/schema.prisma` - Updated InventoryItem model
3. ✅ `src/app/api/inventory/add-from-library/route.ts` - Updated to handle mrp
4. ✅ `src/app/api/inventory/add-from-qr/route.ts` - Updated to handle mrp
5. ✅ `src/lib/db/schema-check.ts` - Dev-only schema validation
6. ✅ `src/app/api/admin/schema-check/route.ts` - Schema check API
7. ✅ `src/components/admin/SchemaWarningBanner.tsx` - Admin banner
8. ✅ `src/app/layout.tsx` - Added banner to layout
9. ✅ `src/lib/prisma.ts` - Added startup check

## Notes

- The `mrp` column is nullable (optional)
- MRP calculation priority: `sellingPrice` → `dpcoCeilingPriceInr` → `priceInr` → `purchasePrice`
- Existing inventory items are backfilled with `selling_price` or `purchase_price`
- The migration is idempotent (safe to run multiple times)
- Queries find existing items by `(tenantId, branchId, drugLibraryId, batchCode)` - NOT by mrp
- Dev-only admin banner appears if schema mismatch detected
