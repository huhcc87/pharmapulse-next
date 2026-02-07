-- Migration: Add tax_category column to drug_library table
-- Run this in Supabase SQL Editor or via psql

-- Add tax_category column if it doesn't exist
ALTER TABLE drug_library 
ADD COLUMN IF NOT EXISTS tax_category TEXT DEFAULT 'TAXABLE';

-- Add index for tax_category if needed (optional, for filtering)
CREATE INDEX IF NOT EXISTS drug_library_tax_category_idx ON drug_library (tax_category);
