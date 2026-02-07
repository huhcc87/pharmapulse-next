-- ============================================
-- PharmaPulse One Billing System Migration
-- ============================================

-- Add new plan fields to Subscription table
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'subscription'; -- 'one_time' or 'subscription'
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS one_time_purchased_at TIMESTAMPTZ;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS one_time_amount_paise INT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS service_renewal_status TEXT DEFAULT 'INACTIVE'; -- ACTIVE, PAST_DUE, INACTIVE
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS service_renewal_next_due TIMESTAMPTZ;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS branches_included INT DEFAULT 1;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS priority_support BOOLEAN DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS monthly_credit_grant INT DEFAULT 0; -- Credits granted per month

-- Create credits ledger table
CREATE TABLE IF NOT EXISTS credits_ledger (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL, -- GRANT_MONTHLY, TOPUP, SPEND, REFUND, EXPIRED
  amount INT NOT NULL, -- Positive for grants/topups, negative for spends/expired
  reference_id TEXT, -- Payment ID, invoice ID, etc.
  reference_type TEXT, -- payment, invoice, grant, etc.
  meta JSONB, -- Additional metadata
  expires_at TIMESTAMPTZ, -- For expiring credits (monthly grants)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_ledger_type CHECK (type IN ('GRANT_MONTHLY', 'TOPUP', 'SPEND', 'REFUND', 'EXPIRED', 'ADJUSTMENT'))
);

CREATE INDEX idx_credits_ledger_org_id ON credits_ledger(org_id);
CREATE INDEX idx_credits_ledger_tenant_id ON credits_ledger(tenant_id);
CREATE INDEX idx_credits_ledger_type ON credits_ledger(type);
CREATE INDEX idx_credits_ledger_created_at ON credits_ledger(created_at DESC);
CREATE INDEX idx_credits_ledger_expires_at ON credits_ledger(expires_at) WHERE expires_at IS NOT NULL;

-- Create credit balance cache table (for performance)
CREATE TABLE IF NOT EXISTS credit_balance_cache (
  org_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  balance INT NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_balance_cache_tenant_id ON credit_balance_cache(tenant_id);

-- Create billing payments table (for one-time purchases and renewals)
CREATE TABLE IF NOT EXISTS billing_payments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  payment_type TEXT NOT NULL, -- PLAN_PURCHASE, RENEWAL, CREDIT_TOPUP
  amount_paise INT NOT NULL,
  currency TEXT DEFAULT 'INR',
  payment_provider TEXT NOT NULL, -- stripe, razorpay, etc.
  provider_payment_id TEXT, -- Stripe payment intent ID, Razorpay order ID, etc.
  provider_customer_id TEXT, -- Stripe customer ID, etc.
  status TEXT NOT NULL DEFAULT 'pending', -- pending, succeeded, failed, refunded
  idempotency_key TEXT UNIQUE, -- For idempotency
  invoice_number TEXT, -- GST invoice number
  invoice_pdf_path TEXT, -- Path to stored invoice PDF
  gst_amount_paise INT DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  
  CONSTRAINT valid_payment_type CHECK (payment_type IN ('PLAN_PURCHASE', 'RENEWAL', 'CREDIT_TOPUP')),
  CONSTRAINT valid_payment_status CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded'))
);

CREATE INDEX idx_billing_payments_org_id ON billing_payments(org_id);
CREATE INDEX idx_billing_payments_tenant_id ON billing_payments(tenant_id);
CREATE INDEX idx_billing_payments_payment_type ON billing_payments(payment_type);
CREATE INDEX idx_billing_payments_status ON billing_payments(status);
CREATE INDEX idx_billing_payments_idempotency_key ON billing_payments(idempotency_key);
CREATE INDEX idx_billing_payments_provider_payment_id ON billing_payments(provider_payment_id);

-- Create billing invoices table (GST-ready)
CREATE TABLE IF NOT EXISTS billing_invoices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL, -- GST invoice number
  payment_id TEXT NOT NULL, -- FK to billing_payments
  invoice_type TEXT NOT NULL, -- PLAN_PURCHASE, RENEWAL, CREDIT_TOPUP
  amount_paise INT NOT NULL,
  gst_amount_paise INT DEFAULT 0,
  total_amount_paise INT NOT NULL,
  hsn_sac_code TEXT, -- HSN/SAC code for GST
  pdf_path TEXT, -- Path to stored PDF
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_billing_invoice_payment FOREIGN KEY (payment_id) REFERENCES billing_payments(id) ON DELETE CASCADE
);

CREATE INDEX idx_billing_invoices_org_id ON billing_invoices(org_id);
CREATE INDEX idx_billing_invoices_tenant_id ON billing_invoices(tenant_id);
CREATE INDEX idx_billing_invoices_invoice_number ON billing_invoices(invoice_number);
CREATE INDEX idx_billing_invoices_payment_id ON billing_invoices(payment_id);

-- Create audit log for billing actions
CREATE TABLE IF NOT EXISTS billing_audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  actor_user_id TEXT,
  action TEXT NOT NULL, -- PLAN_PURCHASED, RENEWAL_SUBSCRIBED, CREDIT_TOPUP, PAYMENT_SUCCESS, PAYMENT_FAILED, etc.
  payment_id TEXT,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_audit_logs_org_id ON billing_audit_logs(org_id);
CREATE INDEX idx_billing_audit_logs_tenant_id ON billing_audit_logs(tenant_id);
CREATE INDEX idx_billing_audit_logs_action ON billing_audit_logs(action);
CREATE INDEX idx_billing_audit_logs_created_at ON billing_audit_logs(created_at DESC);

-- Comments
COMMENT ON TABLE credits_ledger IS 'AI credits ledger for tracking all credit transactions';
COMMENT ON TABLE credit_balance_cache IS 'Cached credit balance for performance (recalculated from ledger)';
COMMENT ON TABLE billing_payments IS 'Billing payments (plan purchase, renewal, credit top-ups)';
COMMENT ON TABLE billing_invoices IS 'GST-ready invoices for billing payments';
COMMENT ON TABLE billing_audit_logs IS 'Audit logs for billing actions';
