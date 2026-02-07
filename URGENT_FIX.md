# ⚡ URGENT FIX - Copy & Paste This SQL NOW

## The Error
"Column inventory_items.mrp does not exist"

## The Fix (2 Minutes)

### Step 1: Run This SQL in Supabase

1. Go to: **Supabase Dashboard → SQL Editor**
2. Click **New Query**
3. Copy and paste this ENTIRE block:

```sql
-- Add mrp column
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS mrp NUMERIC(10,2);

-- Backfill existing data
UPDATE inventory_items SET mrp = selling_price WHERE mrp IS NULL AND selling_price IS NOT NULL;
UPDATE inventory_items SET mrp = purchase_price WHERE mrp IS NULL AND purchase_price IS NOT NULL;
```

4. Click **RUN** (or press Ctrl+Enter / Cmd+Enter)
5. You should see "Success. No rows returned"

### Step 2: Regenerate Prisma

```bash
cd pharmapulse-next
npx prisma generate
```

### Step 3: Restart Server

```bash
npm run dev
```

## ✅ Done!

The error should be gone. Try adding a drug from the Drug Library now.
