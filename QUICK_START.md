# Quick Start Guide - MR Drug Library

## 🚀 Setup Steps

### 1. Database Setup (Supabase)

**Option A: Run SQL Migration**
```sql
-- Copy and paste entire contents of:
-- prisma/migrations/001_drug_library_setup.sql
-- Into Supabase SQL Editor and execute
```

**Option B: Use Prisma Migrate**
```bash
cd pharmapulse-next
npx prisma migrate dev --name drug_library_setup
```

### 2. Generate Prisma Client
```bash
npx prisma generate
```

### 3. Import Drug Library Data
```bash
# Ensure CSV file exists:
# 1) Master Excel-india_allopathy_medicines_253973_fixed.csv

# Run import (takes 5-10 minutes for 253K rows)
npm run db:import-drug-library
```

### 4. Verify Import
The import script will automatically:
- Show import progress
- Search for "Crocin" and display results
- Show total count

**Manual Verification:**
```sql
-- Check total count
SELECT COUNT(*) FROM drug_library;
-- Expected: 253973

-- Check Crocin exists
SELECT brand_name, manufacturer, salts, qr_code 
FROM drug_library 
WHERE brand_name ILIKE '%Crocin%' 
LIMIT 5;
```

## 🧪 Test Search API

### Test 1: Search Crocin
```bash
curl "http://localhost:3000/api/drug-library/search?q=Crocin&limit=5"
```

**Expected**: Returns 5+ Crocin products

### Test 2: Search by Salt
```bash
curl "http://localhost:3000/api/drug-library/search?q=Paracetamol&limit=5"
```

### Test 3: Search by Manufacturer
```bash
curl "http://localhost:3000/api/drug-library/search?q=GlaxoSmithKline&limit=5"
```

## 📱 Test UI

1. Start dev server: `npm run dev`
2. Navigate to: `http://localhost:3000/inventory`
3. Click "Drug Library" button
4. Search for "Crocin"
5. Verify results show all fields
6. Click "Add to Inventory"

## ✅ Success Criteria

- [ ] Import completes without errors
- [ ] Total count = 253,973
- [ ] Crocin search returns results
- [ ] UI shows "MR Drug Library" (not MIMS)
- [ ] All fields displayed in search results
- [ ] Add to Inventory works
- [ ] Audit log created

## 🐛 Common Issues

### Import Fails
- Check DATABASE_URL in .env
- Check CSV file path
- Check Postgres connection

### Search Returns No Results
- Verify data imported: `SELECT COUNT(*) FROM drug_library;`
- Check indexes: `\d drug_library` in psql
- Try direct SQL: `SELECT * FROM drug_library WHERE brand_name ILIKE '%Crocin%';`

### UI Shows "MIMS"
- Clear browser cache
- Restart dev server
- Check `src/components/DrugLibraryModal.tsx` line 131

## 📞 Support

See `IMPLEMENTATION_COMPLETE.md` for full documentation.

