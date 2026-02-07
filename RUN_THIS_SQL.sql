-- COPY AND PASTE THIS INTO SUPABASE SQL EDITOR AND RUN IT
-- This will fix the "inventory_items.mrp does not exist" error

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

-- After running this, run: npx prisma generate
-- Then restart your server: npm run dev
