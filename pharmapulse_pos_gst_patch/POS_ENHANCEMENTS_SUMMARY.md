# POS Enhancements Summary

Included in this patch:
- Barcode scan → product lookup → cart add
- Search add (name/internal code)
- GST-aware totals with HSN buckets
- Intra-state vs inter-state split (CGST/SGST vs IGST)
- Server-side checkout persists Invoice/Lines/TaxLines/Payments
- Printable receipt view

Next recommended additions:
- Returns / refunds (credit note)
- Inventory decrement on sale
- Batch/expiry tracking for regulated items
- Role-based access (cashier vs manager)
- ZPL label printing for shelves
