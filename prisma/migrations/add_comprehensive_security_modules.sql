-- ============================================
-- COMPREHENSIVE SECURITY MODULES MIGRATION
-- PharmaPulse: Server-Authoritative System
-- India Market: GS1/DataMatrix/QR Support
-- ============================================

-- ============================================
-- 1. METERING & USAGE COUNTERS
-- ============================================

CREATE TABLE IF NOT EXISTS usage_counters (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id TEXT NOT NULL,
  license_id TEXT,
  tenant_id TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL, -- Start of billing period
  period_end TIMESTAMPTZ NOT NULL, -- End of billing period
  metric_name TEXT NOT NULL, -- scan_count, ocr_pages, ai_tokens, invoices, exports, api_calls
  count_value BIGINT NOT NULL DEFAULT 0,
  soft_limit BIGINT, -- Warning threshold
  hard_limit BIGINT, -- Block threshold
  overage_count BIGINT DEFAULT 0, -- Usage beyond hard limit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_usage_counter UNIQUE (org_id, license_id, period_start, metric_name)
);

CREATE INDEX idx_usage_counters_org_id ON usage_counters(org_id);
CREATE INDEX idx_usage_counters_license_id ON usage_counters(license_id);
CREATE INDEX idx_usage_counters_tenant_id ON usage_counters(tenant_id);
CREATE INDEX idx_usage_counters_period ON usage_counters(period_start, period_end);
CREATE INDEX idx_usage_counters_metric ON usage_counters(metric_name);

-- Idempotency tracking for paid endpoints
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key_hash TEXT NOT NULL UNIQUE, -- SHA-256 of idempotency key
  org_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_hash TEXT, -- Hash of request body
  response_hash TEXT, -- Hash of response
  status_code INT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_idempotency_keys_hash ON idempotency_keys(key_hash);
CREATE INDEX idx_idempotency_keys_org_id ON idempotency_keys(org_id);
CREATE INDEX idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);

-- ============================================
-- 2. FEATURE FLAGS (Entitlement-Driven)
-- ============================================

-- Global feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  feature_name TEXT NOT NULL UNIQUE, -- drug_scan, rx_ocr, gst_engine, offline_pos, inventory_ai, export_pdf, team_seats, support_sessions
  display_name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- CORE, PREMIUM, ENTERPRISE
  is_enabled_by_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization-level feature overrides
CREATE TABLE IF NOT EXISTS org_feature_overrides (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id TEXT NOT NULL,
  feature_id TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL,
  enabled_by TEXT,
  enabled_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_org_feature UNIQUE (org_id, feature_id)
);

-- License-level feature overrides
CREATE TABLE IF NOT EXISTS license_feature_overrides (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  license_id TEXT NOT NULL,
  feature_id TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL,
  enabled_by TEXT,
  enabled_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_license_feature UNIQUE (license_id, feature_id)
);

CREATE INDEX idx_org_feature_overrides_org_id ON org_feature_overrides(org_id);
CREATE INDEX idx_org_feature_overrides_feature_id ON org_feature_overrides(feature_id);
CREATE INDEX idx_license_feature_overrides_license_id ON license_feature_overrides(license_id);
CREATE INDEX idx_license_feature_overrides_feature_id ON license_feature_overrides(feature_id);

-- ============================================
-- 3. SUPPORT SESSION CODES
-- ============================================

CREATE TABLE IF NOT EXISTS support_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_code TEXT NOT NULL UNIQUE, -- 8-10 char code
  org_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL, -- User who generated code
  support_agent_id TEXT, -- Support agent who joined
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, expired, closed
  scope TEXT NOT NULL DEFAULT 'read_only', -- read_only, diagnostics, view_as_user
  expires_at TIMESTAMPTZ NOT NULL, -- 10-15 minutes from creation
  started_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  closed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_support_sessions_code ON support_sessions(session_code);
CREATE INDEX idx_support_sessions_org_id ON support_sessions(org_id);
CREATE INDEX idx_support_sessions_status ON support_sessions(status);
CREATE INDEX idx_support_sessions_expires_at ON support_sessions(expires_at);

-- Support actions (audit trail)
CREATE TABLE IF NOT EXISTS support_actions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL,
  action_type TEXT NOT NULL, -- view_diagnostics, view_as_user, download_logs, etc.
  performed_by TEXT NOT NULL, -- Support agent ID
  target_user_id TEXT, -- User being viewed (if view_as_user)
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_support_action_session FOREIGN KEY (session_id) REFERENCES support_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_support_actions_session_id ON support_actions(session_id);
CREATE INDEX idx_support_actions_performed_by ON support_actions(performed_by);
CREATE INDEX idx_support_actions_created_at ON support_actions(created_at);

-- Remote diagnostics bundles
CREATE TABLE IF NOT EXISTS diagnostics_bundles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  bundle_type TEXT NOT NULL, -- full, sanitized, logs_only
  file_path TEXT, -- Storage path
  file_hash TEXT, -- SHA-256 hash
  file_size BIGINT,
  generated_by TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  downloaded_at TIMESTAMPTZ,
  downloaded_by TEXT,
  
  CONSTRAINT fk_diagnostics_session FOREIGN KEY (session_id) REFERENCES support_sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_diagnostics_bundles_session_id ON diagnostics_bundles(session_id);
CREATE INDEX idx_diagnostics_bundles_org_id ON diagnostics_bundles(org_id);

-- ============================================
-- 4. ENHANCED AUDIT LOGS (Append-Only + Hash Chaining)
-- ============================================

-- Immutable audit logs with hash chaining
CREATE TABLE IF NOT EXISTS audit_logs_immutable (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  org_id TEXT NOT NULL,
  tenant_id TEXT,
  action TEXT NOT NULL, -- login, logout, device_bind, license_revoke, feature_change, export, support_session, drug_library_edit
  target_type TEXT, -- user, device, license, feature, drug, etc.
  target_id TEXT,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  correlation_id TEXT, -- For tracing requests
  prev_hash TEXT, -- Hash of previous log entry (for chaining)
  hash TEXT NOT NULL UNIQUE, -- SHA-256(prev_hash + actor_id + action + metadata + timestamp)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor_id ON audit_logs_immutable(actor_id);
CREATE INDEX idx_audit_logs_org_id ON audit_logs_immutable(org_id);
CREATE INDEX idx_audit_logs_action ON audit_logs_immutable(action);
CREATE INDEX idx_audit_logs_target ON audit_logs_immutable(target_type, target_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs_immutable(created_at);
CREATE INDEX idx_audit_logs_correlation_id ON audit_logs_immutable(correlation_id);
CREATE INDEX idx_audit_logs_hash ON audit_logs_immutable(hash);

-- Prevent UPDATE/DELETE on audit logs
CREATE OR REPLACE FUNCTION prevent_audit_logs_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit logs are immutable. Cannot % audit_logs_immutable', TG_OP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_audit_logs_modification ON audit_logs_immutable;
CREATE TRIGGER trigger_prevent_audit_logs_modification
  BEFORE UPDATE OR DELETE ON audit_logs_immutable
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_logs_modification();

-- ============================================
-- 5. DRUG SCANNING PIPELINE (India Market)
-- ============================================

-- Enhanced scan events (UPC/EAN + GS1 DataMatrix + QR)
CREATE TABLE IF NOT EXISTS scan_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  device_id TEXT,
  raw_code TEXT NOT NULL, -- Original scanned code
  code_format TEXT NOT NULL, -- UPC, EAN, GS1_DATAMATRIX, QR, INMED
  scan_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  store_id TEXT,
  location_state TEXT, -- Indian state code
  photo_hash TEXT, -- Optional photo hash for verification
  
  -- Resolution results
  resolution_status TEXT NOT NULL DEFAULT 'pending', -- RESOLVED, PARTIAL, UNVERIFIED, CONFLICT
  canonical_drug_id INT, -- FK to drug_products
  canonical_product_id INT, -- FK to products (if inventory item)
  confidence_score DECIMAL(5, 2), -- 0.00 to 100.00
  resolution_method TEXT, -- internal_mapping, trusted_source, manual_review
  
  -- GS1 parsed data
  gtin TEXT, -- GTIN-14 normalized
  expiry_date DATE, -- From EXP (AI 17)
  batch_lot TEXT, -- From BATCH/LOT (AI 10)
  serial_number TEXT, -- From SERIAL (AI 21)
  gs1_ai_data JSONB, -- Full GS1 Application Identifiers
  
  -- Sync metadata
  library_version TEXT,
  delta_sync_token TEXT,
  
  -- Processing
  processed_at TIMESTAMPTZ,
  reviewed_by TEXT, -- Admin who reviewed
  review_status TEXT, -- pending, approved, rejected, flagged
  review_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_events_org_id ON scan_events(org_id);
CREATE INDEX idx_scan_events_tenant_id ON scan_events(tenant_id);
CREATE INDEX idx_scan_events_code_format ON scan_events(code_format);
CREATE INDEX idx_scan_events_resolution_status ON scan_events(resolution_status);
CREATE INDEX idx_scan_events_gtin ON scan_events(gtin);
CREATE INDEX idx_scan_events_scan_time ON scan_events(scan_time);
CREATE INDEX idx_scan_events_review_status ON scan_events(review_status);

-- Drug identifiers (many-to-one mapping)
CREATE TABLE IF NOT EXISTS drug_identifiers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  drug_product_id INT NOT NULL, -- FK to drug_products
  identifier_type TEXT NOT NULL, -- gtin, upc, ean, qr_payload_hash, internal_sku
  identifier_value TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  confidence_score DECIMAL(5, 2),
  source TEXT, -- internal, trusted_source, manual, scan_event
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_drug_identifier UNIQUE (identifier_type, identifier_value)
);

CREATE INDEX idx_drug_identifiers_drug_product_id ON drug_identifiers(drug_product_id);
CREATE INDEX idx_drug_identifiers_type_value ON drug_identifiers(identifier_type, identifier_value);
CREATE INDEX idx_drug_identifiers_is_primary ON drug_identifiers(is_primary);

-- Drug products (canonical)
CREATE TABLE IF NOT EXISTS drug_products (
  id SERIAL PRIMARY KEY,
  brand_name TEXT NOT NULL,
  generic_name TEXT,
  form TEXT, -- tablet, capsule, syrup, injection, etc.
  strength TEXT, -- e.g., "500mg", "10ml"
  manufacturer TEXT,
  marketer TEXT,
  schedule TEXT, -- H, H1, X, etc.
  pack_info JSONB, -- Pack size, units, etc.
  status TEXT NOT NULL DEFAULT 'active', -- active, discontinued, recalled
  source_id TEXT, -- FK to drug_sources
  confidence_score DECIMAL(5, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_drug_products_brand_name ON drug_products(brand_name);
CREATE INDEX idx_drug_products_generic_name ON drug_products(generic_name);
CREATE INDEX idx_drug_products_status ON drug_products(status);
CREATE INDEX idx_drug_products_source_id ON drug_products(source_id);

-- Drug packages (pack sizes, MRP, barcodes)
CREATE TABLE IF NOT EXISTS drug_packages (
  id SERIAL PRIMARY KEY,
  drug_product_id INT NOT NULL,
  pack_size TEXT NOT NULL, -- e.g., "10 tablets", "100ml"
  unit TEXT, -- tablet, ml, etc.
  mrp DECIMAL(10, 2),
  primary_gtin TEXT, -- Primary GTIN-14
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_drug_package_product FOREIGN KEY (drug_product_id) REFERENCES drug_products(id) ON DELETE CASCADE
);

CREATE INDEX idx_drug_packages_drug_product_id ON drug_packages(drug_product_id);
CREATE INDEX idx_drug_packages_primary_gtin ON drug_packages(primary_gtin);

-- Drug sources (provenance)
CREATE TABLE IF NOT EXISTS drug_sources (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source_name TEXT NOT NULL UNIQUE, -- e.g., "CDSCO", "Pharmarack", "AWACS", "Manual"
  source_type TEXT NOT NULL, -- government, licensed_api, public, manual
  license_info JSONB, -- License details if applicable
  api_endpoint TEXT,
  api_key_hash TEXT, -- Hashed API key
  last_sync_at TIMESTAMPTZ,
  sync_frequency TEXT, -- daily, weekly, monthly, manual
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_drug_sources_source_type ON drug_sources(source_type);
CREATE INDEX idx_drug_sources_is_active ON drug_sources(is_active);

-- Drug change log (versioning)
CREATE TABLE IF NOT EXISTS drug_change_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  drug_product_id INT NOT NULL,
  change_type TEXT NOT NULL, -- create, update, delete, merge
  changed_by TEXT,
  before_data JSONB,
  after_data JSONB,
  diff JSONB, -- Computed diff
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_drug_change_product FOREIGN KEY (drug_product_id) REFERENCES drug_products(id) ON DELETE CASCADE
);

CREATE INDEX idx_drug_change_log_drug_product_id ON drug_change_log(drug_product_id);
CREATE INDEX idx_drug_change_log_change_type ON drug_change_log(change_type);
CREATE INDEX idx_drug_change_log_created_at ON drug_change_log(created_at);

-- Review queue for unknown/conflicting scans
CREATE TABLE IF NOT EXISTS drug_review_queue (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  scan_event_id TEXT NOT NULL,
  drug_product_id INT, -- If partial match
  conflict_type TEXT NOT NULL, -- unknown_code, conflicting_match, low_confidence, duplicate_gtin
  priority INT DEFAULT 100, -- Higher = more urgent
  assigned_to TEXT, -- Admin user ID
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_review, approved, rejected, merged
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_review_queue_scan_event FOREIGN KEY (scan_event_id) REFERENCES scan_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_review_queue_drug_product FOREIGN KEY (drug_product_id) REFERENCES drug_products(id) ON DELETE SET NULL
);

CREATE INDEX idx_drug_review_queue_scan_event_id ON drug_review_queue(scan_event_id);
CREATE INDEX idx_drug_review_queue_status ON drug_review_queue(status);
CREATE INDEX idx_drug_review_queue_priority ON drug_review_queue(priority);
CREATE INDEX idx_drug_review_queue_assigned_to ON drug_review_queue(assigned_to);

-- ============================================
-- 6. OFFLINE GRACE PERIOD
-- ============================================

-- Cached entitlements for offline grace
CREATE TABLE IF NOT EXISTS cached_entitlements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id TEXT NOT NULL,
  license_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  entitlement_token TEXT NOT NULL, -- Full entitlement JWT
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- 48-72h from cache time
  last_validated_at TIMESTAMPTZ NOT NULL, -- Last successful online validation
  validation_count INT DEFAULT 0,
  is_valid BOOLEAN DEFAULT true,
  invalidated_at TIMESTAMPTZ,
  invalidated_reason TEXT,
  
  CONSTRAINT unique_cached_entitlement UNIQUE (org_id, license_id, device_id)
);

CREATE INDEX idx_cached_entitlements_org_id ON cached_entitlements(org_id);
CREATE INDEX idx_cached_entitlements_license_id ON cached_entitlements(license_id);
CREATE INDEX idx_cached_entitlements_device_id ON cached_entitlements(device_id);
CREATE INDEX idx_cached_entitlements_expires_at ON cached_entitlements(expires_at);
CREATE INDEX idx_cached_entitlements_is_valid ON cached_entitlements(is_valid);

-- ============================================
-- 7. UPDATE EXISTING TABLES
-- ============================================

-- Add SUPPORT_AGENT to SystemRole enum (handled in Prisma)
-- Add correlation_id to existing audit logs if needed
-- Add org_id to licenses if not present

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE usage_counters IS 'Server-side metering and quota tracking';
COMMENT ON TABLE feature_flags IS 'Entitlement-driven feature flags';
COMMENT ON TABLE support_sessions IS 'Secure support session codes for remote help';
COMMENT ON TABLE audit_logs_immutable IS 'Append-only audit logs with hash chaining';
COMMENT ON TABLE scan_events IS 'Drug scanning events (UPC/EAN/GS1/QR) for Indian market';
COMMENT ON TABLE drug_products IS 'Canonical drug products database';
COMMENT ON TABLE drug_identifiers IS 'Many-to-one mapping of codes to drugs';
COMMENT ON TABLE cached_entitlements IS 'Offline grace period cached entitlements';
