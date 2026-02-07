# Drug Library (253,973) Integration

This patch expects your master sheet has at least:
- name
- internalCode (your NMED-xxxx)
Optionally:
- barcode
- mrp
- salePrice

Importer:
- `scripts/import-drug-library.ts`

HSN/GST mapping:
- `scripts/map-hsn-gst.ts`

Tip:
Start by importing 200 rows (a small test file) before importing the full sheet.
