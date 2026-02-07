# Quick Start: PharmaPulse POS + GST Patch

## 1) Copy files
Copy the contents of this patch into your PharmaPulse repo (merge, do not delete your files).

## 2) Install dependencies
From repo root:
- `npm install`
Add if missing:
- `npm i zustand clsx tailwind-merge xlsx p-limit`
- `npm i -D ts-node`

## 3) Prisma migration
- Merge models from `prisma/schema.models.pos_gst.prisma` into `prisma/schema.prisma`
- `npx prisma migrate dev -n pos_gst_billing`
- `npx prisma generate`

## 4) Seed products
Run:
- `npx ts-node scripts/import-drug-library.ts ./data/Master\ Excel-india_allopathy_medicines_253973_fixed.xlsx`
Then map:
- `npx ts-node scripts/map-hsn-gst.ts ./data/India_Pharma_HSN_GST.xlsx`

## 5) Run app
- `npm run dev`
Open:
- `http://localhost:3000/pos`

## 6) Test scan
Use any barcode present in your Product table.
