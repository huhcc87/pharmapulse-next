-- Migration: Add POS Terminal Enhancements
-- Add fields for invoice details, customer info, payment tracking, and charges

-- Add invoice and billing details
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100),
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add customer information fields
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS buyer_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS buyer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS buyer_address TEXT,
ADD COLUMN IF NOT EXISTS buyer_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS buyer_state VARCHAR(100),
ADD COLUMN IF NOT EXISTS buyer_pincode VARCHAR(10);

-- Add payment tracking
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'UNPAID', -- UNPAID, PARTIALLY_PAID, PAID
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50), -- CASH, CARD, UPI, CHEQUE, BANK_TRANSFER
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100),
ADD COLUMN IF NOT EXISTS paid_amount_paise INT DEFAULT 0;

-- Add additional charges and discounts
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS shipping_charges_paise INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS handling_charges_paise INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS global_discount_paise INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS global_discount_percent DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS coupon_discount_paise INT DEFAULT 0;

-- Add unit types and discounts to line items
ALTER TABLE invoice_line_items
ADD COLUMN IF NOT EXISTS unit_type VARCHAR(20) DEFAULT 'PIECE', -- PIECE, BOX, STRIP, BOTTLE, etc.
ADD COLUMN IF NOT EXISTS discount_paise INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2);

-- Add AI tracking fields
ALTER TABLE invoice_line_items
ADD COLUMN IF NOT EXISTS hsn_source VARCHAR(20) DEFAULT 'DEFAULT', -- MANUAL, AI_SUGGESTED, DEFAULT
ADD COLUMN IF NOT EXISTS gst_source VARCHAR(20) DEFAULT 'DEFAULT',
ADD COLUMN IF NOT EXISTS ai_hsn_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS ai_gst_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS ai_rationale JSONB;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_reference_number ON invoices(reference_number);










