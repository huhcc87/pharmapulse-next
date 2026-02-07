import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

interface DrugRow {
  id?: string;
  brand_name?: string;
  manufacturer?: string;
  price_inr?: string;
  is_discontinued?: string;
  type?: string;
  category?: string;
  pack_size?: string;
  full_composition?: string;
  salts?: string;
  qr_code?: string;
  qr_payload?: string;
}

// Normalize text for search: lowercase, trim, collapse whitespace, remove punctuation
function normalizeText(text: string | null | undefined): string | null {
  if (!text) return null;
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .trim();
}

// Parse price (remove ₹ symbol and keep as string)
function parsePrice(priceStr: string | null | undefined): string | null {
  if (!priceStr) return null;
  // Remove ₹ symbol and any whitespace
  return priceStr.replace(/₹/g, '').replace(/\s/g, '').trim() || null;
}

async function importDrugLibrary() {
  console.log('🚀 Starting Drug Library import with Prisma...');

  // Try multiple possible paths
  const possiblePaths = [
    path.join(__dirname, '../../1) Master Excel-india_allopathy_medicines_253973_fixed.csv'),
    path.join(process.cwd(), '1) Master Excel-india_allopathy_medicines_253973_fixed.csv'),
    process.env.DRUG_CSV_PATH || '',
  ];

  let csvPath = '';
  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
      csvPath = p;
      break;
    }
  }

  if (!csvPath) {
    console.error('❌ CSV file not found. Tried paths:');
    possiblePaths.forEach(p => console.error(`   - ${p}`));
    console.error('\nPlease set DRUG_CSV_PATH environment variable or place CSV in project root');
    process.exit(1);
  }

  console.log(`📖 Reading CSV file: ${csvPath}`);

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  
  // Parse CSV
  const records: DrugRow[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  console.log(`📊 Found ${records.length} records in CSV`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  // Clear existing data
  console.log('🗑️  Clearing existing drug_library data...');
  await prisma.drugLibrary.deleteMany({});

  // Prepare data
  const rows: any[] = [];
  
  for (const row of records) {
    try {
      if (!row.brand_name || row.brand_name.trim() === '') {
        skipped++;
        continue;
      }

      const id = row.id ? parseInt(row.id, 10) : null;
      if (!id || isNaN(id)) {
        skipped++;
        continue;
      }

      const brandName = row.brand_name.trim();
      const manufacturer = row.manufacturer?.trim() || null;
      const salts = row.salts?.trim() || null;
      const fullComposition = row.full_composition?.trim() || null;
      const packSize = row.pack_size?.trim() || null;
      const qrCode = row.qr_code?.trim() || `INMED-${String(id).padStart(6, '0')}`;
      const qrPayload = row.qr_payload?.trim() || `https://airesearchscholar.com/pharma/drug/${qrCode}`;

      rows.push({
        id,
        brandName,
        brandNameNorm: normalizeText(brandName),
        manufacturer,
        manufacturerNorm: normalizeText(manufacturer),
        priceInr: parsePrice(row.price_inr),
        isDiscontinued: row.is_discontinued?.toUpperCase() === 'TRUE' || row.is_discontinued === '1',
        type: row.type?.trim() || null,
        category: row.category?.trim() || null,
        packSize,
        packSizeNorm: normalizeText(packSize),
        fullComposition,
        compositionNorm: normalizeText(fullComposition),
        salts,
        saltsNorm: normalizeText(salts),
        composition1: null,
        composition2: null,
        gstPercent: null,
        schedule: null,
        rxOtc: null,
        dpcoCeilingPriceInr: null,
        qrCode,
        qrPayload,
      });

      if (rows.length % 10000 === 0) {
        process.stdout.write(`\r📦 Prepared: ${rows.length} rows...`);
      }
    } catch (error: any) {
      errors++;
      if (errors <= 10) {
        console.error(`\n❌ Error processing row:`, error.message);
      }
    }
  }

  console.log(`\n📤 Inserting ${rows.length} rows using Prisma createMany...`);

  // Use Prisma createMany for batch inserts (faster than individual inserts)
  const batchSize = 1000;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    
    try {
      // Use Prisma's createMany with skipDuplicates
      await prisma.drugLibrary.createMany({
        data: batch,
        skipDuplicates: true,
      });
      
      imported += batch.length;
      process.stdout.write(`\r✅ Imported: ${imported}/${rows.length} rows...`);
    } catch (error: any) {
      console.error(`\n❌ Error inserting batch ${i / batchSize + 1}:`, error.message);
      // Try individual inserts for this batch
      for (const row of batch) {
        try {
          await prisma.drugLibrary.create({ data: row });
          imported++;
        } catch (err: any) {
          errors++;
        }
      }
    }
  }

  console.log(`\n\n🎉 Import completed!`);
  console.log(`✅ Imported: ${imported}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);

  // Verification query
  console.log('\n🔍 Verification: Searching for "Crocin"...');
  const crocinResults = await prisma.drugLibrary.findMany({
    where: {
      OR: [
        { brandName: { contains: 'Crocin', mode: 'insensitive' } },
        { brandNameNorm: { contains: 'crocin' } },
      ],
      isDiscontinued: false,
    },
    take: 5,
    select: {
      id: true,
      brandName: true,
      manufacturer: true,
      salts: true,
      priceInr: true,
      qrCode: true,
    },
  });

  console.log(`Found ${crocinResults.length} Crocin products:`);
  crocinResults.forEach((drug, idx) => {
    console.log(`  ${idx + 1}. ${drug.brandName} - ${drug.manufacturer || 'N/A'} - ${drug.priceInr || 'N/A'} - ${drug.qrCode}`);
  });

  // Check total count
  const totalCount = await prisma.drugLibrary.count();
  console.log(`\n📊 Total drugs in library: ${totalCount}`);
}

importDrugLibrary()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
