import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

interface MedicineRow {
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

async function importMedicines() {
  console.log('🚀 Starting medicines import...');

  const csvPath = path.join(
    __dirname,
    '../../Drugs list/2) Clean CSV for database import-A_Z_medicines_dataset_of_India_clean (1).csv'
  );

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found at: ${csvPath}`);
    console.log('Please ensure the CSV file exists in the "Drugs list" folder');
    process.exit(1);
  }

  console.log(`📖 Reading CSV file: ${csvPath}`);

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  
  // Parse CSV
  const records: MedicineRow[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  console.log(`📊 Found ${records.length} records in CSV`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches of 1000
  const batchSize = 1000;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1} (${i + 1}-${Math.min(i + batchSize, records.length)})`);

    for (const row of batch) {
      try {
        // Skip if no brand name
        if (!row.brand_name || row.brand_name.trim() === '') {
          skipped++;
          continue;
        }

        const id = row.id ? parseInt(row.id, 10) : i + imported + 1;
        
        // Generate QR code: INMED-000001 format
        const qrCode = `INMED-${String(id).padStart(6, '0')}`;
        
        // Generate QR payload (JSON with drug info)
        const qrPayload = JSON.stringify({
          code: qrCode,
          id,
          brandName: row.brand_name?.trim() || '',
          manufacturer: row.manufacturer?.trim() || null,
          priceInr: row.price_inr ? String(row.price_inr) : null,
          category: row.category?.trim() || null,
          packSize: row.pack_size?.trim() || null,
        });
        
        const medicineData = {
          brandName: row.brand_name?.trim() || '',
          manufacturer: row.manufacturer?.trim() || null,
          priceInr: row.price_inr ? String(row.price_inr) : null,
          isDiscontinued: row.is_discontinued?.toLowerCase() === 'true' || row.is_discontinued === '1',
          type: row.type?.trim() || null,
          category: row.category?.trim() || null,
          packSize: row.pack_size?.trim() || null,
          fullComposition: row.full_composition?.trim() || null,
          salts: row.salts?.trim() || null,
          composition1: row.composition_1?.trim() || null,
          composition2: row.composition_2?.trim() || null,
          gstPercent: row.gst_percent ? parseFloat(row.gst_percent) : null,
          schedule: row.schedule?.trim() || null,
          rxOtc: row.rx_otc?.trim() || null,
          dpcoCeilingPriceInr: row.dpco_ceiling_price_inr ? parseFloat(row.dpco_ceiling_price_inr) : null,
          qrCode,
          qrPayload,
        };

        // Upsert medicine
        await prisma.drugLibrary.upsert({
          where: { id },
          update: medicineData,
          create: { ...medicineData, id },
        });

        imported++;
        if (imported % 100 === 0) {
          process.stdout.write(`\r✅ Imported: ${imported} | Skipped: ${skipped} | Errors: ${errors}`);
        }
      } catch (error: any) {
        errors++;
        if (errors <= 10) {
          console.error(`\n❌ Error importing row ${i + 1}:`, error.message);
        }
      }
    }
  }

  console.log(`\n\n🎉 Import completed!`);
  console.log(`✅ Imported: ${imported}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
}

importMedicines()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

