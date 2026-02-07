-- Migration: Fix RLS and ensure indexes for MR Drug Library
-- Run this in Supabase SQL Editor or via psql

-- Ensure pg_trgm extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Disable RLS on drug_library (it's global data, not tenant-scoped)
ALTER TABLE drug_library DISABLE ROW LEVEL SECURITY;

-- OR if you want to keep RLS enabled, add a policy allowing authenticated users to read:
-- DROP POLICY IF EXISTS drug_library_select_policy ON drug_library;
-- CREATE POLICY drug_library_select_policy ON drug_library
--   FOR SELECT
--   TO authenticated
--   USING (true);

-- Ensure GIN trigram indexes exist for fast search
-- (These may already exist from migration 001, but ensure they're there)

-- Drop existing indexes if they exist (to recreate)
DROP INDEX IF EXISTS drug_library_brand_name_norm_gin_idx;
DROP INDEX IF EXISTS drug_library_salts_norm_gin_idx;
DROP INDEX IF EXISTS drug_library_composition_norm_gin_idx;
DROP INDEX IF EXISTS drug_library_manufacturer_norm_gin_idx;
DROP INDEX IF EXISTS drug_library_pack_size_norm_gin_idx;

-- Create GIN trigram indexes for normalized columns (if they exist)
DO $$
BEGIN
  -- Check if brand_name_norm column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drug_library' AND column_name = 'brand_name_norm'
  ) THEN
    CREATE INDEX IF NOT EXISTS drug_library_brand_name_norm_gin_idx 
      ON drug_library USING gin (brand_name_norm gin_trgm_ops);
  END IF;

  -- Check if salts_norm column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drug_library' AND column_name = 'salts_norm'
  ) THEN
    CREATE INDEX IF NOT EXISTS drug_library_salts_norm_gin_idx 
      ON drug_library USING gin (salts_norm gin_trgm_ops);
  END IF;

  -- Check if composition_norm column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drug_library' AND column_name = 'composition_norm'
  ) THEN
    CREATE INDEX IF NOT EXISTS drug_library_composition_norm_gin_idx 
      ON drug_library USING gin (composition_norm gin_trgm_ops);
  END IF;

  -- Check if manufacturer_norm column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drug_library' AND column_name = 'manufacturer_norm'
  ) THEN
    CREATE INDEX IF NOT EXISTS drug_library_manufacturer_norm_gin_idx 
      ON drug_library USING gin (manufacturer_norm gin_trgm_ops);
  END IF;

  -- Check if pack_size_norm column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'drug_library' AND column_name = 'pack_size_norm'
  ) THEN
    CREATE INDEX IF NOT EXISTS drug_library_pack_size_norm_gin_idx 
      ON drug_library USING gin (pack_size_norm gin_trgm_ops);
  END IF;
END $$;

-- Ensure qr_code is unique and indexed
CREATE UNIQUE INDEX IF NOT EXISTS drug_library_qr_code_unique_idx ON drug_library (qr_code);
CREATE INDEX IF NOT EXISTS drug_library_qr_code_idx ON drug_library (qr_code);

-- Ensure standard indexes exist for common searches
CREATE INDEX IF NOT EXISTS drug_library_brand_name_idx ON drug_library (brand_name);
CREATE INDEX IF NOT EXISTS drug_library_manufacturer_idx ON drug_library (manufacturer);
CREATE INDEX IF NOT EXISTS drug_library_category_idx ON drug_library (category);
CREATE INDEX IF NOT EXISTS drug_library_salts_idx ON drug_library (salts);
CREATE INDEX IF NOT EXISTS drug_library_is_discontinued_idx ON drug_library (is_discontinued);

-- Add comment
COMMENT ON TABLE drug_library IS 'Global drug library (not tenant-scoped). Contains 253,973 Indian medicines with QR codes.';

