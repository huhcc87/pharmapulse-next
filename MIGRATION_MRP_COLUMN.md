# Migration: Add MRP Column to inventory_items Table

This migration adds the `mrp` (Maximum Retail Price) column to the `inventory_items` table.

## Quick Start

### 1. Run the SQL Migration

**Option A: Using Supabase SQL Editor**
1. Open your Supabase project
2. Go to SQL Editor
3. Copy and paste the contents of `prisma/migrations/add_mrp_to_inventory_items.sql`
4. Run the SQL

**Option B: Using psql**
```bash
psql $DATABASE_URL -f prisma/migrations/add_mrp_to_inventory_items.sql
```

### 2. Regenerate Prisma Client

After running the migration, regenerate the Prisma Client:

```bash
cd pharmapulse-next
npx prisma generate
```

### 3. Restart Your Application

```bash
npm run dev
# or
npm start
```

## Migration Details

The migration:
- Adds `mrp NUMERIC(10,2)` column to `inventory_items` table
- Backfills existing rows: sets `mrp = selling_price` where available
- Falls back to `purchase_price` if `selling_price` is NULL

## Verification

### Check Migration Status

**Option 1: Query the database**
```sql
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'inventory_items' 
  AND column_name = 'mrp';
```

**Option 2: Use the dev API endpoint** (development only)
```bash
curl http://localhost:3000/api/admin/schema-check
```

### Expected Result

You should see:
```json
{
  "columnExists": true,
  "message": "Column inventory_items.mrp exists ✓"
}
```

## Troubleshooting

### Error: "column inventory_items.mrp does not exist"

**Solution:** Run the migration file `prisma/migrations/add_mrp_to_inventory_items.sql`

### Error: "Invalid prisma.inventoryItem.findFirst() invocation"

**Solution:**
1. Make sure you've run the SQL migration
2. Run `npx prisma generate`
3. Restart your application

### Schema Mismatch Warning (Dev Only)

If you see a warning in dev mode about missing `mrp` column:
- Run the migration SQL
- Regenerate Prisma client: `npx prisma generate`
- Restart the app

## Files Changed

1. `prisma/migrations/add_mrp_to_inventory_items.sql` - SQL migration
2. `prisma/schema.prisma` - Updated InventoryItem model (mrp field)
3. `src/app/api/inventory/add-from-library/route.ts` - Updated to handle mrp
4. `src/app/api/inventory/add-from-qr/route.ts` - Updated to handle mrp
5. `src/lib/db/schema-check.ts` - Dev-only schema validation utility

## Notes

- The `mrp` column is nullable (optional)
- MRP is calculated from: `sellingPrice` → `dpcoCeilingPriceInr` → `priceInr` → `purchasePrice`
- Existing inventory items will be backfilled with `selling_price` or `purchase_price`
- The migration is idempotent (safe to run multiple times)
