-- ============================================
-- SECURITY HARDENING MIGRATION
-- Phase 1: Auth + RBAC + Licensing
-- ============================================

-- ============================================
-- 1. AUTHENTICATION & SESSION MANAGEMENT
-- ============================================

-- Refresh Tokens (for JWT rotation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of token
  device_id TEXT, -- Device identifier
  device_type TEXT, -- web, windows, mac, android, ios
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT, -- User who revoked
  revoked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  
  CONSTRAINT fk_refresh_token_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_tenant_id ON refresh_tokens(tenant_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_device_id ON refresh_tokens(device_id);

-- Active Sessions (for session management)
CREATE TABLE IF NOT EXISTS active_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  refresh_token_id TEXT, -- FK to refresh_tokens
  device_id TEXT,
  device_type TEXT,
  ip_address INET,
  user_agent TEXT,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  CONSTRAINT fk_session_refresh_token FOREIGN KEY (refresh_token_id) REFERENCES refresh_tokens(id) ON DELETE CASCADE,
  CONSTRAINT fk_session_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_active_sessions_user_id ON active_sessions(user_id);
CREATE INDEX idx_active_sessions_tenant_id ON active_sessions(tenant_id);
CREATE INDEX idx_active_sessions_refresh_token_id ON active_sessions(refresh_token_id);
CREATE INDEX idx_active_sessions_expires_at ON active_sessions(expires_at);
CREATE INDEX idx_active_sessions_device_id ON active_sessions(device_id);

-- MFA Secrets (TOTP)
CREATE TABLE IF NOT EXISTS mfa_secrets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  secret TEXT NOT NULL, -- Encrypted TOTP secret
  backup_codes TEXT[], -- Encrypted backup codes
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_mfa_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT unique_user_mfa UNIQUE (user_id, tenant_id)
);

CREATE INDEX idx_mfa_secrets_user_id ON mfa_secrets(user_id);
CREATE INDEX idx_mfa_secrets_tenant_id ON mfa_secrets(tenant_id);

-- Account Lockout Tracking
CREATE TABLE IF NOT EXISTS account_lockouts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL, -- For lookup by email
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ, -- NULL if not locked
  last_failed_at TIMESTAMPTZ,
  last_failed_ip INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_lockout_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT unique_user_lockout UNIQUE (user_id, tenant_id)
);

CREATE INDEX idx_account_lockouts_user_id ON account_lockouts(user_id);
CREATE INDEX idx_account_lockouts_email ON account_lockouts(email);
CREATE INDEX idx_account_lockouts_locked_until ON account_lockouts(locked_until);

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_password_reset_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- ============================================
-- 2. ENHANCED LICENSING SYSTEM
-- ============================================

-- License Types and States (update enum)
ALTER TYPE "LicenseStatus" ADD VALUE IF NOT EXISTS 'past_due';
ALTER TYPE "LicenseStatus" ADD VALUE IF NOT EXISTS 'revoked';

-- License Types
CREATE TYPE license_type AS ENUM ('TRIAL', 'MONTHLY', 'ANNUAL', 'LIFETIME');

-- Add license type to licenses table
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS license_type license_type DEFAULT 'MONTHLY';
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS subscription_id TEXT; -- Stripe/subscription ID
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS billing_email TEXT;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS max_pc_devices INT DEFAULT 1;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS max_mobile_devices INT DEFAULT 1;

-- License Entitlements (signed, short-lived tokens)
CREATE TABLE IF NOT EXISTS license_entitlements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  license_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  entitlement_token TEXT NOT NULL UNIQUE, -- Signed JWT-like token
  signature TEXT NOT NULL, -- HMAC signature
  expires_at TIMESTAMPTZ NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  last_validated_at TIMESTAMPTZ,
  
  CONSTRAINT fk_entitlement_license FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
  CONSTRAINT fk_entitlement_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_entitlements_tenant_id ON license_entitlements(tenant_id);
CREATE INDEX idx_entitlements_license_id ON license_entitlements(license_id);
CREATE INDEX idx_entitlements_device_id ON license_entitlements(device_id);
CREATE INDEX idx_entitlements_token ON license_entitlements(entitlement_token);
CREATE INDEX idx_entitlements_expires_at ON license_entitlements(expires_at);

-- License Devices (strict binding: 1 PC + 1 mobile)
CREATE TABLE IF NOT EXISTS license_devices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  license_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_type TEXT NOT NULL, -- 'pc' or 'mobile'
  device_secret TEXT NOT NULL, -- Server-issued secret for this device
  device_label TEXT,
  platform TEXT, -- windows, mac, linux, android, ios, web
  app_version TEXT,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  revoked_reason TEXT,
  
  CONSTRAINT fk_license_device_license FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
  CONSTRAINT fk_license_device_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT unique_tenant_device UNIQUE (tenant_id, device_id),
  CONSTRAINT check_device_type CHECK (device_type IN ('pc', 'mobile'))
);

-- Partial unique index: only one active PC and one active mobile per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_pc_device 
  ON license_devices(tenant_id) 
  WHERE device_type = 'pc' AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_mobile_device 
  ON license_devices(tenant_id) 
  WHERE device_type = 'mobile' AND revoked_at IS NULL;

CREATE INDEX idx_license_devices_tenant_id ON license_devices(tenant_id);
CREATE INDEX idx_license_devices_license_id ON license_devices(license_id);
CREATE INDEX idx_license_devices_device_id ON license_devices(device_id);
CREATE INDEX idx_license_devices_device_type ON license_devices(device_type);
CREATE INDEX idx_license_devices_revoked_at ON license_devices(revoked_at);

-- Device Reset Cooldowns
CREATE TABLE IF NOT EXISTS device_reset_cooldowns (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  device_type TEXT NOT NULL,
  reset_count INT NOT NULL DEFAULT 1,
  last_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cooldown_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_reset_cooldown_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT unique_tenant_user_device_reset UNIQUE (tenant_id, user_id, device_type)
);

CREATE INDEX idx_device_reset_cooldowns_tenant_id ON device_reset_cooldowns(tenant_id);
CREATE INDEX idx_device_reset_cooldowns_cooldown_until ON device_reset_cooldowns(cooldown_until);

-- License Events (lifecycle tracking)
CREATE TABLE IF NOT EXISTS license_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  license_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- ACTIVATED, RENEWED, SUSPENDED, REVOKED, EXPIRED, PAST_DUE, DEVICE_ADDED, DEVICE_REMOVED
  actor_user_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_license_event_license FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
  CONSTRAINT fk_license_event_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_license_events_tenant_id ON license_events(tenant_id);
CREATE INDEX idx_license_events_license_id ON license_events(license_id);
CREATE INDEX idx_license_events_event_type ON license_events(event_type);
CREATE INDEX idx_license_events_created_at ON license_events(created_at);

-- ============================================
-- 3. ENHANCED RBAC (Add missing roles)
-- ============================================

-- Update SystemRole enum to include OWNER_ADMIN and ORG_ADMIN
-- Note: Prisma doesn't support ALTER TYPE easily, so we'll handle this in application code
-- For now, we'll use existing OWNER role as OWNER_ADMIN

-- Add ORG_ADMIN role if not exists (handled in seed)

-- ============================================
-- 4. SECURITY EVENTS & MONITORING
-- ============================================

-- Security Events (immutable)
CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT,
  user_id TEXT,
  event_type TEXT NOT NULL, -- LOGIN_FAILED, LOGIN_SUCCESS, LICENSE_COLLISION, EXCESSIVE_REFRESH, ACCOUNT_LOCKED, TOKEN_REVOKED
  severity TEXT NOT NULL DEFAULT 'info', -- info, warning, error, critical
  ip_address INET,
  user_agent TEXT,
  device_id TEXT,
  metadata JSONB,
  correlation_id TEXT, -- For tracing requests
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_security_event_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
);

CREATE INDEX idx_security_events_tenant_id ON security_events(tenant_id);
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_created_at ON security_events(created_at);
CREATE INDEX idx_security_events_correlation_id ON security_events(correlation_id);

-- Make security_events append-only (prevent UPDATE/DELETE)
-- This is enforced at application level, but we can add a trigger for extra safety
CREATE OR REPLACE FUNCTION prevent_security_events_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Security events are immutable. Cannot % security_events', TG_OP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_security_events_modification ON security_events;
CREATE TRIGGER trigger_prevent_security_events_modification
  BEFORE UPDATE OR DELETE ON security_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_security_events_modification();

-- Global Kill Switch
CREATE TABLE IF NOT EXISTS global_kill_switch (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  feature_name TEXT NOT NULL UNIQUE, -- 'app', 'api', 'license', 'auth'
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  message TEXT, -- User-facing message
  enabled_by TEXT,
  enabled_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kill_switch_feature_name ON global_kill_switch(feature_name);
CREATE INDEX idx_kill_switch_is_enabled ON global_kill_switch(is_enabled);

-- Insert default kill switches
INSERT INTO global_kill_switch (feature_name, is_enabled, message) VALUES
  ('app', true, NULL),
  ('api', true, NULL),
  ('license', true, NULL),
  ('auth', true, NULL)
ON CONFLICT (feature_name) DO NOTHING;

-- ============================================
-- 5. RATE LIMITING TRACKING
-- ============================================

-- Rate Limit Tracking (in-memory recommended for production, but DB for persistence)
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  identifier TEXT NOT NULL, -- IP, user_id, tenant_id, etc.
  endpoint TEXT NOT NULL,
  count INT NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_rate_limit_window UNIQUE (identifier, endpoint, window_start)
);

CREATE INDEX idx_rate_limit_identifier ON rate_limit_tracking(identifier);
CREATE INDEX idx_rate_limit_endpoint ON rate_limit_tracking(endpoint);
CREATE INDEX idx_rate_limit_expires_at ON rate_limit_tracking(expires_at);

-- Cleanup function for expired rate limit entries (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_tracking WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. FEATURE FLAGS
-- ============================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  feature_name TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  enabled_by TEXT,
  enabled_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feature_flags_feature_name ON feature_flags(feature_name);
CREATE INDEX idx_feature_flags_is_enabled ON feature_flags(is_enabled);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for secure token rotation';
COMMENT ON TABLE active_sessions IS 'Active user sessions for session management';
COMMENT ON TABLE mfa_secrets IS 'MFA (TOTP) secrets for two-factor authentication';
COMMENT ON TABLE account_lockouts IS 'Account lockout tracking to prevent brute force';
COMMENT ON TABLE license_entitlements IS 'Short-lived, signed license entitlements';
COMMENT ON TABLE license_devices IS 'Strict device binding (1 PC + 1 mobile per license)';
COMMENT ON TABLE security_events IS 'Immutable security event log';
COMMENT ON TABLE global_kill_switch IS 'Global kill switch for emergency shutdown';
COMMENT ON TABLE rate_limit_tracking IS 'Rate limiting tracking (use Redis in production)';
