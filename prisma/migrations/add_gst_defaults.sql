-- Migration: Add default GST rates and NOT NULL constraints
-- This ensures products cannot have NULL gst_rate once published

-- Step 1: Update existing NULL gstRate to default 12% (common for medicines)
UPDATE "Product" 
SET "gstRate" = 12.00 
WHERE "gstRate" IS NULL 
  AND "isActive" = true;

-- Step 2: For inactive products, set to 0 (will be required when activated)
UPDATE "Product" 
SET "gstRate" = 0.00 
WHERE "gstRate" IS NULL 
  AND "isActive" = false;

-- Note: We don't add NOT NULL constraint yet to avoid breaking existing code
-- Instead, we enforce at application level with validation
-- To add NOT NULL constraint in future:
-- ALTER TABLE "Product" ALTER COLUMN "gstRate" SET NOT NULL;
-- ALTER TABLE "Product" ALTER COLUMN "gstRate" SET DEFAULT 12.00;

-- Step 3: Ensure HSN codes exist for active products (optional, can be done via app)
-- UPDATE "Product" 
-- SET "hsnCode" = '3004' 
-- WHERE "hsnCode" IS NULL 
--   AND "isActive" = true 
--   AND "category" LIKE '%medicine%';
