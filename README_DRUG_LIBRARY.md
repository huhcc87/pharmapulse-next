# Drug Library Implementation - Complete ✅

## Overview
Full drug library system with branded + generic search, tenant-scoped mappings, and fast search popup integration.

## Database Schema

### Core Models
- **DrugMolecule** - Active ingredients (Paracetamol, Metformin, etc.)
- **DrugFormulation** - Canonical drug definitions (e.g., "Paracetamol 650 mg Tablet")
- **DrugFormulationMolecule** - Join table for multi-salt formulations
- **Manufacturer** - Drug manufacturers
- **DrugBrand** - Brand names (Dolo 650, Glycomet, etc.)
- **DrugPack** - SKU-level with barcodes, MRP, GST, HSN
- **DrugAlias** - Global aliases (brand/formulation/molecule/barcode/hindi/common)

### Tenant Models
- **TenantProductMap** - Pharmacy-specific product mappings
- **TenantAlias** - Tenant-specific aliases and corrections

## Setup

### 1. Database Migration
```bash
npm run db:push
npm run db:generate
```

### 2. Seed Data
```bash
npm run db:seed
```

This seeds:
- Dolo 650 (Paracetamol 650mg) with barcode `8901234567890`
- 5+ additional common drugs
- 2 combo drugs (Amoxicillin+Clavulanic, Omeprazole+Domperidone)
- Aliases for brand names, generic names, barcodes, common names

## API Endpoints

### Search
**GET** `/api/drug-library/search?q=&limit=&tenantId=`

**Ranking Priority:**
1. Barcode exact match (score: 100)
2. Tenant aliases (score: 80-90)
3. Global aliases (score: 50-90)
4. Brand name contains (score: 50-80)
5. Formulation name contains (score: 50-75)
6. Molecule name contains (score: 30-70)

**Response:**
```json
[
  {
    "type": "PACK",
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

### Tenant Mapping
**POST** `/api/drug-library/tenant/map`
- Create/update product mappings
- Requires `idempotencyKey`
- Maps localProductId to pack/brand/formulation

**POST** `/api/drug-library/tenant/alias`
- Add tenant-specific aliases
- Requires `idempotencyKey`

**GET** `/api/drug-library/tenant/mappings?tenantId=&localProductId=`
- Fetch mappings with confidence and source

## Frontend Components

### DrugSearchCombobox
Reusable search component with:
- 250ms debounced search
- Keyboard navigation (Arrow keys, Enter, Escape)
- Barcode paste detection
- Auto-fill on selection
- "Not found? Add alias/mapping" option

**Usage:**
```tsx
<DrugSearchCombobox
  onSelect={(result) => {
    // Handle selection
    console.log(result);
  }}
  placeholder="Search drugs..."
  tenantId={1} // Optional
  onBarcodeScan={(barcode) => {
    // Handle barcode scan
  }}
/>
```

### Integration
- ✅ Integrated into `AddProductModal`
- When PACK is selected, auto-fills: name, composition, MRP, GST, HSN, packSize

## Features

### ✅ Implemented
1. Prisma schema with all models and indexes
2. Seed data with demo drugs
3. Search API with intelligent ranking
4. DrugSearchCombobox component
5. Tenant mapping endpoints with idempotency
6. Integration into Inventory Add Product flow
7. Removed MIMS.com external link

### 🔄 Future Enhancements
- Full-text search with pg_trgm (PostgreSQL)
- RBAC enforcement for mapping endpoints
- Batch import/export
- Search analytics
- Unit tests for ranking algorithm
- Integration tests for tenant scoping

## Testing

### Manual Test
1. Open Inventory > Add Product
2. Use Drug Library Search box
3. Search for "dolo" or "paracetamol" or barcode "8901234567890"
4. Select result - form should auto-fill
5. Test tenant alias creation via API

### Seed Verification
```bash
# Check seeded data
npx prisma studio
```

## Performance Notes
- Search limited to 50 results max
- Indexes on alias, brand name, tenantId
- SQLite compatible (PostgreSQL recommended for production)
- TODO: Add pg_trgm for fuzzy search in production

## File Structure
```
prisma/
  schema.prisma          # All drug library models
  seed.ts                # Demo seed data

src/app/api/drug-library/
  search/route.ts        # Search API with ranking
  tenant/
    map/route.ts         # Product mapping endpoint
    alias/route.ts       # Tenant alias endpoint
    mappings/route.ts    # Get mappings endpoint

src/components/
  DrugSearchCombobox.tsx # Reusable search component
  AddProductModal.tsx    # Integrated with search
  DrugLibraryModal.tsx   # Updated (MIMS link removed)
```

## Next Steps
1. Add RBAC middleware to tenant endpoints
2. Implement "Add alias/mapping" modal in DrugSearchCombobox
3. Add unit tests for search ranking
4. Add integration tests for tenant scoping
5. Migrate to PostgreSQL for production
6. Add full-text search with pg_trgm

