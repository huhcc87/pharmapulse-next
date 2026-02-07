-- Migration: Add mrp column to inventory_items table
-- 
-- EXACT TERMINAL COMMANDS TO RUN:
-- 1. Run this SQL in your database (Supabase SQL Editor or psql):
--    psql $DATABASE_URL -f prisma/migrations/add_mrp_to_inventory_items.sql
--    OR copy/paste this file into Supabase SQL Editor and execute
--
-- 2. Pull schema from database (optional, to sync):
--    npx prisma db pull
--
-- 3. Regenerate Prisma Client:
--    npx prisma generate
--
-- 4. Restart your server:
--    npm run dev
--    OR
--    npm start

-- Add mrp column if it doesn't exist (NUMERIC for precise currency values)
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS mrp NUMERIC(10,2);

-- Backfill: Set mrp = selling_price where mrp is NULL and selling_price exists
-- (selling_price is the "price" field used in inventory)
UPDATE inventory_items
SET mrp = selling_price
WHERE mrp IS NULL 
  AND selling_price IS NOT NULL;

-- Backfill: Set mrp = purchase_price where mrp is still NULL and purchase_price exists
UPDATE inventory_items
SET mrp = purchase_price
WHERE mrp IS NULL 
  AND purchase_price IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN inventory_items.mrp IS 'Maximum Retail Price (MRP) in INR - NUMERIC(10,2) for currency precision';
