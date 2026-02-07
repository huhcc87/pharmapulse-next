# Prisma patch: POS + GST + HSN + Billing (India)

This patch adds tables for:
- Product master (UPC/barcode, HSN, GST flags)
- Invoice, InvoiceLine, TaxLine, Payment
- Customer (optional)
- PrintJob (optional) if you use a local print bridge

## How to apply
1) Open `prisma/schema.prisma`
2) Copy the **models** from `prisma/schema.models.pos_gst.prisma` into your schema.
3) Run:
   - `npx prisma migrate dev -n pos_gst_billing`
   - `npx prisma generate`

> If you already have Product/Customer/Invoice tables, merge fields rather than duplicating.
