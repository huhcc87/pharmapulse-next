import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Normalize text for search
function normalizeText(text: string | null | undefined): string | null {
  if (!text) return null;
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

// Sample Indian drugs for testing
const sampleDrugs = [
  {
    brandName: 'Crocin 500mg Tablet',
    manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd',
    salts: 'Paracetamol 500mg',
    fullComposition: 'Paracetamol 500mg',
    packSize: '15 tablets',
    category: 'Tablet',
    type: 'Analgesic',
    priceInr: '25.00',
    gstPercent: 12.0,
    schedule: 'H',
    rxOtc: 'OTC',
    isDiscontinued: false,
    qrCode: 'INMED-000001',
    qrPayload: 'https://airesearchscholar.com/pharma/drug/INMED-000001',
  },
  {
    brandName: 'Crocin Advance 500mg Tablet',
    manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd',
    salts: 'Paracetamol 500mg',
    fullComposition: 'Paracetamol 500mg',
    packSize: '10 tablets',
    category: 'Tablet',
    type: 'Analgesic',
    priceInr: '20.00',
    gstPercent: 12.0,
    schedule: 'H',
    rxOtc: 'OTC',
    isDiscontinued: false,
    qrCode: 'INMED-000002',
    qrPayload: 'https://airesearchscholar.com/pharma/drug/INMED-000002',
  },
  {
    brandName: 'Dolo 650mg Tablet',
    manufacturer: 'Micro Labs Ltd',
    salts: 'Paracetamol 650mg',
    fullComposition: 'Paracetamol 650mg',
    packSize: '15 tablets',
    category: 'Tablet',
    type: 'Analgesic',
    priceInr: '30.00',
    gstPercent: 12.0,
    schedule: 'H',
    rxOtc: 'OTC',
    isDiscontinued: false,
    qrCode: 'INMED-000003',
    qrPayload: 'https://airesearchscholar.com/pharma/drug/INMED-000003',
  },
  {
    brandName: 'Calpol 500mg Tablet',
    manufacturer: 'GlaxoSmithKline Pharmaceuticals Ltd',
    salts: 'Paracetamol 500mg',
    fullComposition: 'Paracetamol 500mg',
    packSize: '15 tablets',
    category: 'Tablet',
    type: 'Analgesic',
    priceInr: '28.00',
    gstPercent: 12.0,
    schedule: 'H',
    rxOtc: 'OTC',
    isDiscontinued: false,
    qrCode: 'INMED-000004',
    qrPayload: 'https://airesearchscholar.com/pharma/drug/INMED-000004',
  },
  {
    brandName: 'Paracetamol 500mg Tablet',
    manufacturer: 'Various',
    salts: 'Paracetamol 500mg',
    fullComposition: 'Paracetamol 500mg',
    packSize: '10 tablets',
    category: 'Tablet',
    type: 'Analgesic',
    priceInr: '15.00',
    gstPercent: 12.0,
    schedule: 'H',
    rxOtc: 'OTC',
    isDiscontinued: false,
    qrCode: 'INMED-000005',
    qrPayload: 'https://airesearchscholar.com/pharma/drug/INMED-000005',
  },
  {
    brandName: 'Azithromycin 500mg Tablet',
    manufacturer: 'Cipla Ltd',
    salts: 'Azithromycin 500mg',
    fullComposition: 'Azithromycin 500mg',
    packSize: '3 tablets',
    category: 'Tablet',
    type: 'Antibiotic',
    priceInr: '120.00',
    gstPercent: 12.0,
    schedule: 'H1',
    rxOtc: 'Rx',
    isDiscontinued: false,
    qrCode: 'INMED-000006',
    qrPayload: 'https://airesearchscholar.com/pharma/drug/INMED-000006',
  },
  {
    brandName: 'Amoxicillin 500mg Capsule',
    manufacturer: 'Alkem Laboratories Ltd',
    salts: 'Amoxicillin 500mg',
    fullComposition: 'Amoxicillin 500mg',
    packSize: '10 capsules',
    category: 'Capsule',
    type: 'Antibiotic',
    priceInr: '85.00',
    gstPercent: 12.0,
    schedule: 'H',
    rxOtc: 'Rx',
    isDiscontinued: false,
    qrCode: 'INMED-000007',
    qrPayload: 'https://airesearchscholar.com/pharma/drug/INMED-000007',
  },
  {
    brandName: 'Omeprazole 20mg Capsule',
    manufacturer: 'Dr. Reddy\'s Laboratories Ltd',
    salts: 'Omeprazole 20mg',
    fullComposition: 'Omeprazole 20mg',
    packSize: '10 capsules',
    category: 'Capsule',
    type: 'Antacid',
    priceInr: '45.00',
    gstPercent: 12.0,
    schedule: 'H',
    rxOtc: 'Rx',
    isDiscontinued: false,
    qrCode: 'INMED-000008',
    qrPayload: 'https://airesearchscholar.com/pharma/drug/INMED-000008',
  },
  {
    brandName: 'Cetirizine 10mg Tablet',
    manufacturer: 'Sun Pharmaceutical Industries Ltd',
    salts: 'Cetirizine 10mg',
    fullComposition: 'Cetirizine 10mg',
    packSize: '10 tablets',
    category: 'Tablet',
    type: 'Antihistamine',
    priceInr: '35.00',
    gstPercent: 12.0,
    schedule: 'H',
    rxOtc: 'OTC',
    isDiscontinued: false,
    qrCode: 'INMED-000009',
    qrPayload: 'https://airesearchscholar.com/pharma/drug/INMED-000009',
  },
  {
    brandName: 'Metformin 500mg Tablet',
    manufacturer: 'USV Ltd',
    salts: 'Metformin 500mg',
    fullComposition: 'Metformin Hydrochloride 500mg',
    packSize: '10 tablets',
    category: 'Tablet',
    type: 'Antidiabetic',
    priceInr: '25.00',
    gstPercent: 12.0,
    schedule: 'H',
    rxOtc: 'Rx',
    isDiscontinued: false,
    qrCode: 'INMED-000010',
    qrPayload: 'https://airesearchscholar.com/pharma/drug/INMED-000010',
  },
  {
    brandName: 'Pantoprazole 40mg Tablet',
    manufacturer: 'Torrent Pharmaceuticals Ltd',
    salts: 'Pantoprazole 40mg',
    fullComposition: 'Pantoprazole 40mg',
    packSize: '10 tablets',
    category: 'Tablet',
    type: 'Antacid',
    priceInr: '55.00',
    gstPercent: 12.0,
    schedule: 'H',
    rxOtc: 'Rx',
    isDiscontinued: false,
    qrCode: 'INMED-000011',
    qrPayload: 'https://airesearchscholar.com/pharma/drug/INMED-000011',
  },
  {
    brandName: 'Montelukast 10mg Tablet',
    manufacturer: 'Lupin Ltd',
    salts: 'Montelukast 10mg',
    fullComposition: 'Montelukast 10mg',
    packSize: '10 tablets',
    category: 'Tablet',
    type: 'Antiasthmatic',
    priceInr: '95.00',
    gstPercent: 12.0,
    schedule: 'H',
    rxOtc: 'Rx',
    isDiscontinued: false,
    qrCode: 'INMED-000012',
    qrPayload: 'https://airesearchscholar.com/pharma/drug/INMED-000012',
  },
  {
    brandName: 'Amlodipine 5mg Tablet',
    manufacturer: 'Cadila Healthcare Ltd',
    salts: 'Amlodipine 5mg',
    fullComposition: 'Amlodipine 5mg',
    packSize: '10 tablets',
    category: 'Tablet',
    type: 'Antihypertensive',
    priceInr: '40.00',
    gstPercent: 12.0,
    schedule: 'H',
    rxOtc: 'Rx',
    isDiscontinued: false,
    qrCode: 'INMED-000013',
    qrPayload: 'https://airesearchscholar.com/pharma/drug/INMED-000013',
  },
  {
    brandName: 'Atorvastatin 10mg Tablet',
    manufacturer: 'Pfizer Ltd',
    salts: 'Atorvastatin 10mg',
    fullComposition: 'Atorvastatin 10mg',
    packSize: '10 tablets',
    category: 'Tablet',
    type: 'Antilipidemic',
    priceInr: '75.00',
    gstPercent: 12.0,
    schedule: 'H',
    rxOtc: 'Rx',
    isDiscontinued: false,
    qrCode: 'INMED-000014',
    qrPayload: 'https://airesearchscholar.com/pharma/drug/INMED-000014',
  },
  {
    brandName: 'Levothyroxine 50mcg Tablet',
    manufacturer: 'Abbott India Ltd',
    salts: 'Levothyroxine 50mcg',
    fullComposition: 'Levothyroxine 50mcg',
    packSize: '100 tablets',
    category: 'Tablet',
    type: 'Hormone',
    priceInr: '150.00',
    gstPercent: 12.0,
    schedule: 'H',
    rxOtc: 'Rx',
    isDiscontinued: false,
    qrCode: 'INMED-000015',
    qrPayload: 'https://airesearchscholar.com/pharma/drug/INMED-000015',
  },
];

async function seedDrugLibrary() {
  console.log('🚀 Seeding Drug Library with sample drugs...');

  try {
    // Check if drugs already exist
    const existingCount = await prisma.drugLibrary.count();
    if (existingCount > 0) {
      console.log(`⚠️  Drug library already has ${existingCount} drugs. Skipping seed.`);
      console.log('💡 To add sample drugs, clear the database first or use the import script.');
      return;
    }

    console.log(`📦 Adding ${sampleDrugs.length} sample drugs...`);

    for (const drug of sampleDrugs) {
      await prisma.drugLibrary.create({
        data: {
          brandName: drug.brandName,
          brandNameNorm: normalizeText(drug.brandName),
          manufacturer: drug.manufacturer,
          manufacturerNorm: normalizeText(drug.manufacturer),
          salts: drug.salts,
          saltsNorm: normalizeText(drug.salts),
          fullComposition: drug.fullComposition,
          compositionNorm: normalizeText(drug.fullComposition),
          packSize: drug.packSize,
          packSizeNorm: normalizeText(drug.packSize),
          category: drug.category,
          type: drug.type,
          priceInr: drug.priceInr,
          gstPercent: drug.gstPercent,
          schedule: drug.schedule,
          rxOtc: drug.rxOtc,
          isDiscontinued: drug.isDiscontinued,
          qrCode: drug.qrCode,
          qrPayload: drug.qrPayload,
        },
      });
    }

    console.log(`✅ Successfully added ${sampleDrugs.length} sample drugs!`);
    
    // Verify by searching
    const crocinCount = await prisma.drugLibrary.count({
      where: {
        brandName: { contains: 'Crocin', mode: 'insensitive' },
      },
    });
    
    console.log(`🔍 Verification: Found ${crocinCount} Crocin products`);
    console.log('');
    console.log('🧪 Test search:');
    console.log('   - Search for "Crocin" → Should find 2 results');
    console.log('   - Search for "Paracetamol" → Should find 5 results');
    console.log('   - Search for "Dolo" → Should find 1 result');
    console.log('');
    console.log('✅ Drug library is ready for testing!');
  } catch (error) {
    console.error('❌ Error seeding drug library:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedDrugLibrary()
  .then(() => {
    console.log('✅ Seed completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });

