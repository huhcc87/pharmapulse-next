-- ============================================
-- ANALYTICS PERMISSIONS MIGRATION
-- ============================================

-- Add ANALYTICS permissions to Permission enum
-- Note: Prisma doesn't support ALTER TYPE easily, so we handle this in application code
-- The enum values are already added to schema.prisma

-- Create user_permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  granted_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  
  CONSTRAINT fk_user_permission_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  CONSTRAINT unique_user_permission UNIQUE (tenant_id, user_id, permission_id)
);

CREATE INDEX idx_user_permissions_tenant_id ON user_permissions(tenant_id);
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission_id ON user_permissions(permission_id);
CREATE INDEX idx_user_permissions_revoked_at ON user_permissions(revoked_at);

-- Update step_up_sessions to support analytics_unlock
ALTER TABLE step_up_sessions ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT 'general';
ALTER TABLE step_up_sessions ADD COLUMN IF NOT EXISTS challenge_id TEXT UNIQUE;
ALTER TABLE step_up_sessions ADD COLUMN IF NOT EXISTS token TEXT;
ALTER TABLE step_up_sessions ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE step_up_sessions ADD COLUMN IF NOT EXISTS failed_attempts INT DEFAULT 0;
ALTER TABLE step_up_sessions ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_step_up_sessions_purpose ON step_up_sessions(purpose);
CREATE INDEX IF NOT EXISTS idx_step_up_sessions_challenge_id ON step_up_sessions(challenge_id);

-- Insert ANALYTICS permissions
INSERT INTO permissions (id, name, display_name, description, category, created_at) VALUES
  (gen_random_uuid()::text, 'ANALYTICS_VIEW', 'View Analytics', 'Access to analytics dashboard', 'ANALYTICS', NOW()),
  (gen_random_uuid()::text, 'ANALYTICS_VIEW_REVENUE', 'View Revenue Analytics', 'View revenue and financial metrics', 'ANALYTICS', NOW()),
  (gen_random_uuid()::text, 'ANALYTICS_VIEW_SALES', 'View Sales Analytics', 'View sales volume and trends', 'ANALYTICS', NOW()),
  (gen_random_uuid()::text, 'ANALYTICS_VIEW_PRODUCTS', 'View Product Analytics', 'View product performance metrics', 'ANALYTICS', NOW()),
  (gen_random_uuid()::text, 'ANALYTICS_EXPORT', 'Export Analytics', 'Export analytics data to CSV/PDF', 'ANALYTICS', NOW())
ON CONFLICT (name) DO NOTHING;

-- Grant ANALYTICS_VIEW to OWNER role by default
INSERT INTO role_permissions (id, role_id, permission_id, created_at)
SELECT 
  gen_random_uuid()::text,
  r.id,
  p.id,
  NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'OWNER'
  AND p.name IN ('ANALYTICS_VIEW', 'ANALYTICS_VIEW_REVENUE', 'ANALYTICS_VIEW_SALES', 'ANALYTICS_VIEW_PRODUCTS', 'ANALYTICS_EXPORT')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE user_permissions IS 'User-specific permissions granted by Owner';
COMMENT ON COLUMN step_up_sessions.purpose IS 'Purpose: general, analytics_unlock, export, etc.';
COMMENT ON COLUMN step_up_sessions.token IS 'Analytics unlock token (JWT) for analytics_unlock purpose';
