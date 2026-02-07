# Migration Instructions - GST, Billing & Payments

## Step 1: Database Migration

```bash
cd pharmapulse-next
npx prisma migrate dev --name add_gst_billing_payments
npx prisma generate
```

## Step 2: Seed HSN Master Data (Optional but Recommended)

Create a seed script or run SQL directly:

```sql
-- Common medicine HSN codes
INSERT INTO hsn_master (id, hsn_code, description, default_gst_rate, gst_type, is_active, created_at, updated_at)
VALUES 
  (gen_random_uuid(), '3004', 'Medicaments (medicines) for therapeutic or prophylactic uses', 12.00, 'EXCLUSIVE', true, NOW(), NOW()),
  (gen_random_uuid(), '3003', 'Medicaments for therapeutic or prophylactic uses', 12.00, 'EXCLUSIVE', true, NOW(), NOW()),
  (gen_random_uuid(), '3002', 'Human blood; animal blood', 12.00, 'EXCLUSIVE', true, NOW(), NOW())
ON CONFLICT (hsn_code) DO NOTHING;
```

## Step 3: Create HSN Rules for Auto-Mapping (Optional)

```sql
-- Example: Map "Crocin" to HSN 3004
INSERT INTO hsn_rules (hsn_code, match_type, pattern, priority, enabled, created_at, updated_at)
SELECT hsn_code, 'CONTAINS', 'crocin', 50, true, NOW(), NOW()
FROM hsn_master WHERE hsn_code = '3004'
ON CONFLICT DO NOTHING;
```

## Step 4: Configure Org GST Settings

Update your org record with GST details:

```sql
UPDATE orgs 
SET 
  legal_name = 'Your Pharmacy Legal Name',
  trade_name = 'Your Pharmacy Trade Name',
  address_line1 = 'Your Address',
  city = 'Your City',
  state = 'Your State',
  pincode = 'Your Pincode',
  state_code = '27', -- Maharashtra example
  place_of_supply_policy = 'CUSTOMER_STATE'
WHERE tenant_id = 1;
```

## Step 5: Test the Implementation

1. **Test Cart Validation**:
   - Add items to cart
   - Click Checkout
   - Verify validation shows HSN issues if missing

2. **Test HSN Auto-Mapping**:
   - Add item without HSN
   - System should suggest HSN based on rules
   - Use quick-fix modal to confirm

3. **Test Invoice Issue**:
   - Complete checkout flow
   - Verify invoice created with correct GST
   - Check invoice print page

4. **Test GSTR-1 Export**:
   - Create some invoices
   - Visit: `/api/reports/gstr1?from=2024-01-01&to=2024-12-31`
   - Download and verify CSV

## Step 6: Update Existing Data (If Needed)

If you have existing products without HSN codes:

```sql
-- Set default HSN for medicines (example)
UPDATE products 
SET hsn_code = '3004', gst_rate = 12.00
WHERE hsn_code IS NULL AND category LIKE '%medicine%' OR category LIKE '%drug%';
```

## Troubleshooting

1. **Migration fails**: Check for existing data conflicts
2. **HSN not mapping**: Verify HsnRule records exist and are enabled
3. **GST calculation wrong**: Check supply type (intra vs inter-state)
4. **Payment fails**: Verify idempotency keys are unique

## Notes

- All calculations are server-side for accuracy
- Invoice numbers follow format: `PREFIX/FY/SEQUENCE` (e.g., INV/24-25/0001)
- GSTR-1 export includes all required fields for tax filing
- Credit customers require `isCreditCustomer = true` and `creditLimit` set
