-- Enterprise Security: RBAC, Step-up Auth, Maker-Checker, Tamper-evident Audit, Export Controls, Support Mode

-- Create enums
CREATE TYPE "SystemRole" AS ENUM ('OWNER', 'ADMIN', 'PHARMACIST', 'CASHIER', 'INVENTORY', 'AUDITOR');
CREATE TYPE "Permission" AS ENUM (
  'REFUND_CREATE', 'DISCOUNT_OVERRIDE', 'PRICE_EDIT', 'STOCK_ADJUST', 
  'GST_EDIT', 'EXPORT_DATA', 'USER_MANAGE', 'LICENSE_MANAGE', 
  'APPROVE_ACTIONS', 'VIEW_AUDIT', 'SUPPORT_ACCESS'
);
CREATE TYPE "StepUpMethod" AS ENUM ('PASSWORD', 'TOTP', 'MAGIC_LINK');
CREATE TYPE "PendingActionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
CREATE TYPE "SupportSessionScope" AS ENUM ('READ_ONLY', 'DIAGNOSTICS');

-- Roles table
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" "SystemRole" NOT NULL UNIQUE,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- Permissions table
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" "Permission" NOT NULL UNIQUE,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- Role-Permission mapping
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "role_permissions_role_id_permission_id_key" UNIQUE ("role_id", "permission_id")
);

-- User-Role mapping (tenant-scoped)
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "assigned_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_roles_tenant_id_user_id_role_id_key" UNIQUE ("tenant_id", "user_id", "role_id")
);

-- Step-up Authentication Sessions
CREATE TABLE "step_up_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "method" "StepUpMethod" NOT NULL,
    "verified_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "step_up_sessions_pkey" PRIMARY KEY ("id")
);

-- Maker-Checker Pending Actions
CREATE TABLE "pending_actions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "created_by" TEXT NOT NULL,
    "status" "PendingActionStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" TEXT,
    "rejected_by" TEXT,
    "rejection_reason" TEXT,
    "executed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    CONSTRAINT "pending_actions_pkey" PRIMARY KEY ("id")
);

-- Tamper-evident Security Audit Logs (hash chaining)
CREATE TABLE "security_audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "prev_hash" TEXT,
    "hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "security_audit_logs_tenant_id_created_at_hash_key" UNIQUE ("tenant_id", "created_at", "hash")
);

-- Export Records (with watermarking)
CREATE TABLE "export_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "export_type" TEXT NOT NULL,
    "export_id" TEXT NOT NULL UNIQUE,
    "file_path" TEXT,
    "watermark" JSONB NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "export_records_pkey" PRIMARY KEY ("id")
);

-- Support Sessions (consent-based, time-bound)
CREATE TABLE "support_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "enabled_by" TEXT NOT NULL,
    "scope" "SupportSessionScope" NOT NULL DEFAULT 'READ_ONLY',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "support_user_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    CONSTRAINT "support_sessions_pkey" PRIMARY KEY ("id")
);

-- Security Configuration (thresholds, rate limits)
CREATE TABLE "security_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL UNIQUE,
    "refund_threshold" DECIMAL(12, 2),
    "discount_threshold" DECIMAL(5, 2),
    "export_rate_limit" INTEGER NOT NULL DEFAULT 10,
    "step_up_timeout_minutes" INTEGER NOT NULL DEFAULT 10,
    "support_session_minutes" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "security_configs_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" 
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" 
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" 
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");
CREATE INDEX "user_roles_tenant_id_user_id_idx" ON "user_roles"("tenant_id", "user_id");
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");
CREATE INDEX "step_up_sessions_tenant_id_user_id_expires_at_idx" ON "step_up_sessions"("tenant_id", "user_id", "expires_at");
CREATE INDEX "step_up_sessions_expires_at_idx" ON "step_up_sessions"("expires_at");
CREATE INDEX "pending_actions_tenant_id_status_idx" ON "pending_actions"("tenant_id", "status");
CREATE INDEX "pending_actions_created_by_idx" ON "pending_actions"("created_by");
CREATE INDEX "pending_actions_action_type_idx" ON "pending_actions"("action_type");
CREATE INDEX "pending_actions_created_at_idx" ON "pending_actions"("created_at");
CREATE INDEX "security_audit_logs_tenant_id_created_at_idx" ON "security_audit_logs"("tenant_id", "created_at" DESC);
CREATE INDEX "security_audit_logs_actor_user_id_idx" ON "security_audit_logs"("actor_user_id");
CREATE INDEX "security_audit_logs_action_idx" ON "security_audit_logs"("action");
CREATE INDEX "security_audit_logs_hash_idx" ON "security_audit_logs"("hash");
CREATE INDEX "export_records_tenant_id_user_id_idx" ON "export_records"("tenant_id", "user_id");
CREATE INDEX "export_records_export_type_idx" ON "export_records"("export_type");
CREATE INDEX "export_records_created_at_idx" ON "export_records"("created_at");
CREATE INDEX "export_records_export_id_idx" ON "export_records"("export_id");
CREATE INDEX "support_sessions_tenant_id_is_active_expires_at_idx" ON "support_sessions"("tenant_id", "is_active", "expires_at");
CREATE INDEX "support_sessions_enabled_by_idx" ON "support_sessions"("enabled_by");

-- Insert default system roles
INSERT INTO "roles" ("id", "name", "display_name", "description", "is_system") VALUES
    (gen_random_uuid()::text, 'OWNER', 'Owner', 'Full system access, can manage all settings', true),
    (gen_random_uuid()::text, 'ADMIN', 'Administrator', 'Can manage users and most settings', true),
    (gen_random_uuid()::text, 'PHARMACIST', 'Pharmacist', 'Can verify prescriptions and manage inventory', true),
    (gen_random_uuid()::text, 'CASHIER', 'Cashier', 'Can process sales and returns', true),
    (gen_random_uuid()::text, 'INVENTORY', 'Inventory Manager', 'Can manage stock and inventory', true),
    (gen_random_uuid()::text, 'AUDITOR', 'Auditor', 'Read-only access to audit logs and reports', true);

-- Insert all permissions
INSERT INTO "permissions" ("id", "name", "display_name", "description", "category") VALUES
    (gen_random_uuid()::text, 'REFUND_CREATE', 'Create Refunds', 'Can create refund transactions', 'FINANCIAL'),
    (gen_random_uuid()::text, 'DISCOUNT_OVERRIDE', 'Override Discounts', 'Can apply discounts above threshold', 'FINANCIAL'),
    (gen_random_uuid()::text, 'PRICE_EDIT', 'Edit Prices', 'Can modify product prices', 'INVENTORY'),
    (gen_random_uuid()::text, 'STOCK_ADJUST', 'Adjust Stock', 'Can adjust inventory quantities', 'INVENTORY'),
    (gen_random_uuid()::text, 'GST_EDIT', 'Edit GST', 'Can modify GST settings and rates', 'COMPLIANCE'),
    (gen_random_uuid()::text, 'EXPORT_DATA', 'Export Data', 'Can export invoices, reports, and data', 'DATA'),
    (gen_random_uuid()::text, 'USER_MANAGE', 'Manage Users', 'Can create and manage user accounts', 'ADMIN'),
    (gen_random_uuid()::text, 'LICENSE_MANAGE', 'Manage License', 'Can manage licensing settings', 'ADMIN'),
    (gen_random_uuid()::text, 'APPROVE_ACTIONS', 'Approve Actions', 'Can approve pending actions (maker-checker)', 'ADMIN'),
    (gen_random_uuid()::text, 'VIEW_AUDIT', 'View Audit Logs', 'Can view security audit logs', 'AUDIT'),
    (gen_random_uuid()::text, 'SUPPORT_ACCESS', 'Support Access', 'Can enable support mode', 'ADMIN');

-- Assign permissions to roles
-- OWNER gets all permissions
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT 
    gen_random_uuid()::text,
    r.id,
    p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.name = 'OWNER';

-- ADMIN gets most permissions except LICENSE_MANAGE
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT 
    gen_random_uuid()::text,
    r.id,
    p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.name = 'ADMIN' AND p.name != 'LICENSE_MANAGE';

-- PHARMACIST: STOCK_ADJUST, PRICE_EDIT, VIEW_AUDIT
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT 
    gen_random_uuid()::text,
    r.id,
    p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.name = 'PHARMACIST' 
    AND p.name IN ('STOCK_ADJUST', 'PRICE_EDIT', 'VIEW_AUDIT');

-- CASHIER: REFUND_CREATE, DISCOUNT_OVERRIDE (below threshold)
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT 
    gen_random_uuid()::text,
    r.id,
    p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.name = 'CASHIER' 
    AND p.name IN ('REFUND_CREATE', 'DISCOUNT_OVERRIDE');

-- INVENTORY: STOCK_ADJUST, PRICE_EDIT
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT 
    gen_random_uuid()::text,
    r.id,
    p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.name = 'INVENTORY' 
    AND p.name IN ('STOCK_ADJUST', 'PRICE_EDIT');

-- AUDITOR: VIEW_AUDIT, EXPORT_DATA
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT 
    gen_random_uuid()::text,
    r.id,
    p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.name = 'AUDITOR' 
    AND p.name IN ('VIEW_AUDIT', 'EXPORT_DATA');

-- Create default security config for existing tenants
INSERT INTO "security_configs" ("id", "tenant_id", "refund_threshold", "discount_threshold", "export_rate_limit", "step_up_timeout_minutes", "support_session_minutes")
SELECT 
    gen_random_uuid()::text,
    t.id,
    1000.00,  -- ₹1000 refund threshold
    10.00,    -- 10% discount threshold
    10,       -- 10 exports per hour
    10,       -- 10 minutes step-up timeout
    30        -- 30 minutes support session
FROM "tenants" t
WHERE NOT EXISTS (
    SELECT 1 FROM "security_configs" sc WHERE sc.tenant_id = t.id
);

-- Add database policy to prevent UPDATE/DELETE on security_audit_logs (append-only)
-- Note: This requires RLS (Row Level Security) to be enabled
-- For now, we enforce this at application level, but can add DB triggers if needed

COMMENT ON TABLE "security_audit_logs" IS 'Tamper-evident audit log. Append-only. Never UPDATE or DELETE.';
COMMENT ON TABLE "export_records" IS 'Export records with watermarking for data leakage prevention.';
COMMENT ON TABLE "support_sessions" IS 'Consent-based, time-bound support access sessions.';
