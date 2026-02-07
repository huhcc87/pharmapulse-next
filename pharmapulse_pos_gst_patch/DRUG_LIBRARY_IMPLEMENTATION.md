# Drug Library Implementation Notes

Recommended strategy:
- Treat `internalCode` as primary key (stable).
- Use barcode when available (fast scan).
- Keep name normalization for search.

Quality controls:
- Log duplicates
- Flag missing HSN
- Flag missing GST rate
- Keep audit tables for mapping changes
