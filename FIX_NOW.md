# ⚡ QUICK FIX - Run These 3 Commands

## The Problem
Your database is missing the `mrp` column. The code is ready, you just need to add the column.

## The Fix (3 Steps)

### Step 1: Run SQL in Supabase
1. Open Supabase Dashboard → SQL Editor
2. Copy this SQL and paste it:

```sql
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS mrp NUMERIC(10,2);
UPDATE inventory_items SET mrp = selling_price WHERE mrp IS NULL AND selling_price IS NOT NULL;
UPDATE inventory_items SET mrp = purchase_price WHERE mrp IS NULL AND purchase_price IS NOT NULL;
```

3. Click **RUN**

### Step 2: Regenerate Prisma
```bash
cd pharmapulse-next
npx prisma generate
```

### Step 3: Restart Server
```bash
npm run dev
```

## Done! ✅

The error should be gone. Try adding a drug from the Drug Library now.
