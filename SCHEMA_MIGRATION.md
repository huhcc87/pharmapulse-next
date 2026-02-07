# Schema Migration Required

## Changes Made

1. **Added `originalInvoiceId` field to Invoice model** for credit notes/returns
2. **Added `roundOffPaise` field to Invoice model** for round-off calculation

## Migration Steps

Run these commands to apply the schema changes:

```bash
cd pharmapulse-next
npx prisma migrate dev --name add_original_invoice_and_round_off
npx prisma generate
```

## Schema Changes

### Invoice Model
```prisma
model Invoice {
  // ... existing fields ...
  
  // Added for credit notes/returns
  originalInvoiceId Int? @map("original_invoice_id")
  originalInvoice   Invoice? @relation("InvoiceReturn", fields: [originalInvoiceId], references: [id], onDelete: SetNull)
  returns           Invoice[] @relation("InvoiceReturn")
  
  // Added for round-off
  roundOffPaise     Int @default(0) @map("round_off_paise")
  
  // ... rest of fields ...
}
```

## API Updates

- `src/app/api/invoices/route.ts` - Now accepts and stores `roundOffPaise`
- `src/app/api/invoices/[id]/credit-note/route.ts` - Updated to use `originalInvoiceId`

## Notes

- `originalInvoiceId` uses Int (matching Invoice.id type)
- `roundOffPaise` defaults to 0 for existing invoices
- Credit notes link to original invoice via `originalInvoiceId`
- Round-off is applied after GST calculation


