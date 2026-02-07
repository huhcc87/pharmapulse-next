# Quick Fix: Inventory MRP Column Missing

## Problem
Error: "The column inventory_items.mrp does not exist in the current database."

## Solution (3 Steps)

### Step 1: Run SQL Migration

**Option A: Using Supabase SQL Editor (Easiest)**
1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy and paste this SQL:

```sql
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS mrp NUMERIC(10,2);

UPDATE inventory_items
SET mrp = selling_price
WHERE mrp IS NULL 
  AND selling_price IS NOT NULL;

UPDATE inventory_items
SET mrp = purchase_price
WHERE mrp IS NULL 
  AND purchase_price IS NOT NULL;
```

5. Click **Run** (or press Ctrl+Enter)

**Option B: Using psql**
```bash
cd pharmapulse-next
psql $DATABASE_URL -f prisma/migrations/add_mrp_to_inventory_items.sql
```

### Step 2: Regenerate Prisma Client
```bash
cd pharmapulse-next
npx prisma generate
```

### Step 3: Restart Server
```bash
npm run dev
```

## Verify It Works

After running the migration, the yellow banner should disappear. Try adding a drug from the Drug Library - it should work now!

## Need Help?

If you still see the error:
1. Make sure Step 1 (SQL migration) ran successfully
2. Check that `npx prisma generate` completed without errors
3. Make sure you restarted the server after Step 2
