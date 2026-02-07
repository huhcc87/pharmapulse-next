import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sampleDrugs = [
  {
    brandName: 'Crocin 500mg',
    qrCode: 'INMED-000001',
    qrPayload: 'INMED-000001',
    manufacturer: 'GSK',
    packSize: '10 Tablets',
    priceInr: '45.00',
    gstPercent: 12.0,
    salts: 'Paracetamol',
    fullComposition: 'Paracetamol 500mg',
  },
  {
    brandName: 'Dolo 650mg',
    qrCode: 'INMED-000002',
    qrPayload: 'INMED-000002',
    manufacturer: 'Micro Labs',
    packSize: '15 Tablets',
    priceInr: '35.00',
    gstPercent: 12.0,
    salts: 'Paracetamol',
    fullComposition: 'Paracetamol 650mg',
  },
  {
    brandName: 'Azithromycin 500mg',
    qrCode: 'INMED-000003',
    qrPayload: 'INMED-000003',
    manufacturer: 'Cipla',
    packSize: '3 Tablets',
    priceInr: '120.00',
    gstPercent: 12.0,
    salts: 'Azithromycin',
    fullComposition: 'Azithromycin 500mg',
  },
  {
    brandName: 'Amoxicillin 500mg',
    qrCode: 'INMED-000004',
    qrPayload: 'INMED-000004',
    manufacturer: 'Alkem',
    packSize: '10 Capsules',
    priceInr: '85.00',
    gstPercent: 12.0,
    salts: 'Amoxicillin',
    fullComposition: 'Amoxicillin 500mg',
  },
  {
    brandName: 'Cetirizine 10mg',
    qrCode: 'INMED-000005',
    qrPayload: 'INMED-000005',
    manufacturer: 'Dr. Reddy\'s',
    packSize: '10 Tablets',
    priceInr: '25.00',
    gstPercent: 12.0,
    salts: 'Cetirizine',
    fullComposition: 'Cetirizine 10mg',
  },
];

async function main() {
  console.log('Seeding sample drugs...');

  for (const drug of sampleDrugs) {
    try {
      await prisma.drugLibrary.upsert({
        where: { qrCode: drug.qrCode },
        update: drug,
        create: drug,
      });
      console.log(`✓ Seeded: ${drug.brandName}`);
    } catch (error) {
      console.error(`✗ Failed to seed ${drug.brandName}:`, error);
    }
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });







