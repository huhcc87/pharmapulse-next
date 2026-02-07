# Drug Library Implementation Plan

## File Structure

### New Files Created:
1. `prisma/schema.prisma` - Updated with drug library models
2. `prisma/seed.ts` - Seed data for demo drugs
3. `src/app/api/drug-library/search/route.ts` - Search API with ranking
4. `src/components/DrugSearchCombobox.tsx` - Reusable search component (TO BE CREATED)
5. `src/app/api/drug-library/tenant/map/route.ts` - Tenant mapping endpoint (TO BE CREATED)
6. `src/app/api/drug-library/tenant/alias/route.ts` - Tenant alias endpoint (TO BE CREATED)
7. `src/app/api/drug-library/tenant/mappings/route.ts` - Get mappings endpoint (TO BE CREATED)

### Modified Files:
1. `package.json` - Added seed script
2. `src/components/DrugLibraryModal.tsx` - Remove MIMS.com link (TO BE DONE)

## Database Schema

### Models Created:
- `DrugMolecule` - Active ingredients
- `DrugFormulation` - Canonical drug definitions
- `DrugFormulationMolecule` - Join table for multi-salt formulations
- `Manufacturer` - Drug manufacturers
- `DrugBrand` - Brand names
- `DrugPack` - SKU-level with barcodes
- `DrugAlias` - Global aliases (brand/formulation/molecule/barcode/hindi/common)
- `TenantProductMap` - Tenant-specific product mappings
- `TenantAlias` - Tenant-specific aliases

## Seed Data

Run seed with:
```bash
npm run db:seed
```

Includes:
- Dolo 650 (Paracetamol 650mg) with barcode 8901234567890
- 5+ additional common drugs
- 2 combo drugs (Amoxicillin+Clavulanic, Omeprazole+Domperidone)
- Aliases for brand names, generic names, barcodes, common names

## Search API

### Endpoint: `GET /api/drug-library/search?q=&limit=&tenantId=`

**Ranking Priority:**
1. Barcode exact match (score: 100)
2. Tenant aliases (score: 80-90)
3. Global aliases (score: 50-90)
4. Brand name contains (score: 50-80)
5. Formulation name contains (score: 50-75)
6. Molecule name contains (score: 30-70)

**Response Format:**
```json
[
  {
    "type": "PACK" | "BRAND" | "FORMULATION" | "MOLECULE",
    "packId": 1,
    "brandId": 1,
    "formulationId": 1,
    "brand": "Dolo 650",
    "formulation": "Paracetamol 650 mg Tablet",
    "composition": "Paracetamol 650mg",
    "packSize": "15 tablets",
    "mrp": 30.0,
    "gstRate": 12.0,
    "hsn": "30049099",
    "matchReason": "Barcode exact match",
    "confidence": 1.0,
    "score": 100
  }
]
```

## Next Steps

1. ✅ Prisma schema updated
2. ✅ Seed file created
3. ✅ Search API implemented
4. ⏳ Create DrugSearchCombobox component
5. ⏳ Create tenant mapping endpoints
6. ⏳ Remove MIMS.com link
7. ⏳ Integrate into Inventory page
8. ⏳ Add tests

## Migration Commands

```bash
# Push schema changes
npm run db:push

# Generate Prisma client
npm run db:generate

# Seed database
npm run db:seed
```

