-- Enterprise Licensing Enforcement Migration
-- Adds: License, DeviceRegistration, IpChangeRequest, LicenseAuditLog

-- Create enums
CREATE TYPE "LicenseStatus" AS ENUM ('active', 'suspended', 'expired');
CREATE TYPE "IpPolicy" AS ENUM ('single', 'cidr');
CREATE TYPE "DeviceType" AS ENUM ('web', 'windows', 'mac', 'android', 'ios');
CREATE TYPE "IpChangeStatus" AS ENUM ('pending', 'approved', 'rejected');

-- License table (one per tenant)
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'professional',
    "status" "LicenseStatus" NOT NULL DEFAULT 'active',
    "max_devices" INTEGER NOT NULL DEFAULT 1,
    "ip_policy" "IpPolicy" NOT NULL DEFAULT 'single',
    "allowed_ip" TEXT,
    "allowed_cidr" TEXT,
    "last_checkin_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- Device registrations (one active per tenant)
CREATE TABLE "device_registrations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "device_id" TEXT NOT NULL,
    "device_type" "DeviceType" NOT NULL DEFAULT 'web',
    "device_label" TEXT,
    "registered_ip" TEXT,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "device_registrations_pkey" PRIMARY KEY ("id")
);

-- IP change requests (with guardrails)
CREATE TABLE "ip_change_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "new_ip" TEXT NOT NULL,
    "status" "IpChangeStatus" NOT NULL DEFAULT 'pending',
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ip_change_requests_pkey" PRIMARY KEY ("id")
);

-- License audit logs (tamper-evident)
CREATE TABLE "license_audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_audit_logs_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "device_registrations" ADD CONSTRAINT "device_registrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "licenses"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ip_change_requests" ADD CONSTRAINT "ip_change_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "licenses"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "license_audit_logs" ADD CONSTRAINT "license_audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "licenses"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique constraints
CREATE UNIQUE INDEX "licenses_tenant_id_key" ON "licenses"("tenant_id");
CREATE UNIQUE INDEX "device_registrations_tenant_id_device_id_key" ON "device_registrations"("tenant_id", "device_id");

-- Partial unique index: only one active device per tenant
-- PostgreSQL supports partial unique indexes
CREATE UNIQUE INDEX "device_registrations_tenant_id_active_key" 
ON "device_registrations"("tenant_id") 
WHERE "revoked_at" IS NULL;

-- Indexes for performance
CREATE INDEX "licenses_status_idx" ON "licenses"("status");
CREATE INDEX "device_registrations_tenant_id_revoked_at_idx" ON "device_registrations"("tenant_id", "revoked_at");
CREATE INDEX "device_registrations_device_id_idx" ON "device_registrations"("device_id");
CREATE INDEX "device_registrations_last_seen_at_idx" ON "device_registrations"("last_seen_at");
CREATE INDEX "ip_change_requests_tenant_id_idx" ON "ip_change_requests"("tenant_id");
CREATE INDEX "ip_change_requests_status_idx" ON "ip_change_requests"("status");
CREATE INDEX "ip_change_requests_created_at_idx" ON "ip_change_requests"("created_at");
CREATE INDEX "license_audit_logs_tenant_id_created_at_idx" ON "license_audit_logs"("tenant_id", "created_at" DESC);
CREATE INDEX "license_audit_logs_action_idx" ON "license_audit_logs"("action");
CREATE INDEX "license_audit_logs_created_at_idx" ON "license_audit_logs"("created_at");

-- Create default licenses for existing tenants (if any)
-- This ensures all tenants have a license record
INSERT INTO "licenses" ("id", "tenant_id", "plan", "status", "max_devices", "ip_policy", "created_at", "updated_at")
SELECT 
    gen_random_uuid()::text,
    t.id,
    'professional',
    'active',
    1,
    'single',
    NOW(),
    NOW()
FROM "tenants" t
WHERE NOT EXISTS (
    SELECT 1 FROM "licenses" l WHERE l.tenant_id = t.id
);
