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
  composition_1?: string;
  composition_2?: string;
  gst_percent?: string;
  schedule?: string;
  rx_otc?: string;
  dpco_ceiling_price_inr?: string;
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

async function importDrugLibrary() {
  console.log('🚀 Starting Drug Library import...');

  // Try multiple possible paths
  const possiblePaths = [
    path.join(__dirname, '../../Drugs list/2) Clean CSV for database import-A_Z_medicines_dataset_of_India_clean (1).csv'),
    path.join(process.cwd(), 'Drugs list/2) Clean CSV for database import-A_Z_medicines_dataset_of_India_clean (1).csv'),
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
    console.error('\nPlease set DRUG_CSV_PATH environment variable or place CSV in "Drugs list" folder');
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
  let lastId = 0;

  // Get max ID from existing records
  try {
    const maxRecord = await prisma.drugLibrary.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    if (maxRecord) {
      lastId = maxRecord.id;
    }
  } catch (error) {
    // Table might not exist yet, that's okay
    console.log('⚠️  DrugLibrary table not found or empty, starting from ID 1');
  }

  // Process in batches of 500 for better performance
  const batchSize = 500;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1} (${i + 1}-${Math.min(i + batchSize, records.length)})`);

    const batchData = [];

    for (const row of batch) {
      try {
        // Skip if no brand name
        if (!row.brand_name || row.brand_name.trim() === '') {
          skipped++;
          continue;
        }

        const id = row.id ? parseInt(row.id, 10) : ++lastId;
        if (isNaN(id)) {
          skipped++;
          continue;
        }

        const brandName = row.brand_name.trim();
        const manufacturer = row.manufacturer?.trim() || null;
        const salts = row.salts?.trim() || null;
        const fullComposition = row.full_composition?.trim() || null;

        // Generate QR code: INMED-000001 format
        const qrCode = `INMED-${String(id).padStart(6, '0')}`;
        
        // Generate QR payload (JSON with drug info)
        const qrPayload = JSON.stringify({
          code: qrCode,
          id,
          brandName,
          manufacturer,
          salts,
          fullComposition,
          priceInr: row.price_inr ? String(row.price_inr) : null,
          category: row.category?.trim() || null,
          packSize: row.pack_size?.trim() || null,
        });

        const drugData = {
          id,
          brandName,
          brandNameNorm: normalizeText(brandName),
          manufacturer,
          manufacturerNorm: normalizeText(manufacturer),
          priceInr: row.price_inr ? String(row.price_inr) : null,
          isDiscontinued: row.is_discontinued?.toLowerCase() === 'true' || row.is_discontinued === '1' || row.is_discontinued === 'TRUE',
          type: row.type?.trim() || null,
          category: row.category?.trim() || null,
          packSize: row.pack_size?.trim() || null,
          fullComposition,
          compositionNorm: normalizeText(fullComposition),
          salts,
          saltsNorm: normalizeText(salts),
          composition1: row.composition_1?.trim() || null,
          composition2: row.composition_2?.trim() || null,
          gstPercent: row.gst_percent ? parseFloat(row.gst_percent) : null,
          schedule: row.schedule?.trim() || null,
          rxOtc: row.rx_otc?.trim() || null,
          dpcoCeilingPriceInr: row.dpco_ceiling_price_inr ? parseFloat(row.dpco_ceiling_price_inr) : null,
          qrCode,
          qrPayload,
        };

        batchData.push(drugData);
      } catch (error: any) {
        errors++;
        if (errors <= 10) {
          console.error(`\n❌ Error processing row ${i + 1}:`, error.message);
        }
      }
    }

    // Bulk upsert batch
    try {
      for (const data of batchData) {
        await prisma.drugLibrary.upsert({
          where: { id: data.id },
          update: data,
          create: data,
        });
        imported++;
        if (imported % 100 === 0) {
          process.stdout.write(`\r✅ Imported: ${imported} | Skipped: ${skipped} | Errors: ${errors}`);
        }
      }
    } catch (error: any) {
      console.error(`\n❌ Error upserting batch:`, error.message);
      errors += batchData.length;
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
    },
  });

  console.log(`Found ${crocinResults.length} Crocin products:`);
  crocinResults.forEach((drug, idx) => {
    console.log(`  ${idx + 1}. ${drug.brandName} - ${drug.manufacturer || 'N/A'} - ₹${drug.priceInr || 'N/A'}`);
  });
}

importDrugLibrary()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

