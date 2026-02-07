-- Migration: Add supply_type column to invoices table
-- This adds the missing supply_type column that exists in Prisma schema but not in database

-- Add supply_type column (nullable string for INTRA_STATE or INTER_STATE)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS supply_type VARCHAR(20);

-- Add comment for documentation
COMMENT ON COLUMN invoices.supply_type IS 'Supply type: INTRA_STATE or INTER_STATE';
