-- Migration: Drug Library Setup with pg_trgm indexes
-- Run this in Supabase SQL Editor or via psql

-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create drug_library table
CREATE TABLE IF NOT EXISTS drug_library (
  id INTEGER PRIMARY KEY,
  brand_name TEXT NOT NULL,
  brand_name_norm TEXT,
  manufacturer TEXT,
  manufacturer_norm TEXT,
  price_inr TEXT,
  is_discontinued BOOLEAN DEFAULT FALSE,
  type TEXT,
  category TEXT,
  pack_size TEXT,
  pack_size_norm TEXT,
  full_composition TEXT,
  composition_norm TEXT,
  salts TEXT,
  salts_norm TEXT,
  composition_1 TEXT,
  composition_2 TEXT,
  gst_percent DECIMAL(5,2),
  schedule TEXT,
  rx_otc TEXT,
  dpco_ceiling_price_inr DECIMAL(12,2),
  qr_code TEXT UNIQUE NOT NULL,
  qr_payload TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create GIN trigram indexes for fast fuzzy search
CREATE INDEX IF NOT EXISTS drug_library_brand_name_norm_gin_idx 
  ON drug_library USING gin (brand_name_norm gin_trgm_ops);

CREATE INDEX IF NOT EXISTS drug_library_salts_norm_gin_idx 
  ON drug_library USING gin (salts_norm gin_trgm_ops);

CREATE INDEX IF NOT EXISTS drug_library_composition_norm_gin_idx 
  ON drug_library USING gin (composition_norm gin_trgm_ops);

CREATE INDEX IF NOT EXISTS drug_library_manufacturer_norm_gin_idx 
  ON drug_library USING gin (manufacturer_norm gin_trgm_ops);

CREATE INDEX IF NOT EXISTS drug_library_pack_size_norm_gin_idx 
  ON drug_library USING gin (pack_size_norm gin_trgm_ops);

-- Standard indexes
CREATE INDEX IF NOT EXISTS drug_library_brand_name_idx ON drug_library (brand_name);
CREATE INDEX IF NOT EXISTS drug_library_manufacturer_idx ON drug_library (manufacturer);
CREATE INDEX IF NOT EXISTS drug_library_category_idx ON drug_library (category);
CREATE INDEX IF NOT EXISTS drug_library_salts_idx ON drug_library (salts);
CREATE INDEX IF NOT EXISTS drug_library_is_discontinued_idx ON drug_library (is_discontinued);
CREATE INDEX IF NOT EXISTS drug_library_qr_code_idx ON drug_library (qr_code);
CREATE INDEX IF NOT EXISTS drug_library_full_composition_idx ON drug_library (full_composition);

-- Create scan events table
CREATE TABLE IF NOT EXISTS drug_scan_events (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  branch_id INTEGER,
  user_id INTEGER,
  qr_code TEXT NOT NULL,
  drug_library_id INTEGER NOT NULL REFERENCES drug_library(id),
  scanned_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS drug_scan_events_tenant_id_idx ON drug_scan_events (tenant_id);
CREATE INDEX IF NOT EXISTS drug_scan_events_branch_id_idx ON drug_scan_events (branch_id);
CREATE INDEX IF NOT EXISTS drug_scan_events_qr_code_idx ON drug_scan_events (qr_code);
CREATE INDEX IF NOT EXISTS drug_scan_events_drug_library_id_idx ON drug_scan_events (drug_library_id);
CREATE INDEX IF NOT EXISTS drug_scan_events_scanned_at_idx ON drug_scan_events (scanned_at);

-- Create scan memory table
CREATE TABLE IF NOT EXISTS drug_scan_memory (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  branch_id INTEGER,
  qr_code TEXT NOT NULL,
  drug_library_id INTEGER NOT NULL REFERENCES drug_library(id),
  last_scanned_at TIMESTAMP DEFAULT NOW(),
  last_added_to_inventory_at TIMESTAMP,
  scan_count INTEGER DEFAULT 1,
  UNIQUE(tenant_id, branch_id, qr_code)
);

CREATE INDEX IF NOT EXISTS drug_scan_memory_tenant_id_idx ON drug_scan_memory (tenant_id);
CREATE INDEX IF NOT EXISTS drug_scan_memory_branch_id_idx ON drug_scan_memory (branch_id);
CREATE INDEX IF NOT EXISTS drug_scan_memory_tenant_branch_idx ON drug_scan_memory (tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS drug_scan_memory_qr_code_idx ON drug_scan_memory (qr_code);
CREATE INDEX IF NOT EXISTS drug_scan_memory_drug_library_id_idx ON drug_scan_memory (drug_library_id);

-- Create inventory_items table (if not exists)
CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  branch_id INTEGER,
  drug_library_id INTEGER NOT NULL REFERENCES drug_library(id),
  qty_on_hand INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 0,
  expiry_date TIMESTAMP,
  purchase_price DECIMAL(12,2),
  selling_price DECIMAL(12,2),
  batch_code TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, branch_id, drug_library_id, batch_code)
);

CREATE INDEX IF NOT EXISTS inventory_items_tenant_id_idx ON inventory_items (tenant_id);
CREATE INDEX IF NOT EXISTS inventory_items_branch_id_idx ON inventory_items (branch_id);
CREATE INDEX IF NOT EXISTS inventory_items_tenant_branch_idx ON inventory_items (tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS inventory_items_drug_library_id_idx ON inventory_items (drug_library_id);

-- Create audit_log table (if not exists)
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  branch_id INTEGER,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  before_json TEXT,
  after_json TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_tenant_id_idx ON audit_log (tenant_id);
CREATE INDEX IF NOT EXISTS audit_log_branch_id_idx ON audit_log (branch_id);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log (entity, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at);

