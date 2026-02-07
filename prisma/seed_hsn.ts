import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Common Indian pharmacy HSN codes
const hsnCodes = [
  {
    hsnCode: '3004',
    description: 'Medicaments (medicines) containing pharmaceutical substances',
    gstRate: 12,
    gstType: 'EXCLUSIVE',
    category: 'Pharmaceuticals',
  },
  {
    hsnCode: '3003',
    description: 'Medicaments (medicines) - bulk drugs',
    gstRate: 18,
    gstType: 'EXCLUSIVE',
    category: 'Bulk Drugs',
  },
  {
    hsnCode: '3006',
    description: 'Pharmaceutical goods',
    gstRate: 12,
    gstType: 'EXCLUSIVE',
    category: 'Pharmaceuticals',
  },
  {
    hsnCode: '9018',
    description: 'Instruments and appliances used in medical, surgical, dental or veterinary sciences',
    gstRate: 12,
    gstType: 'EXCLUSIVE',
    category: 'Medical Instruments',
  },
  {
    hsnCode: '9021',
    description: 'Orthopedic appliances, including crutches, surgical belts and trusses',
    gstRate: 5,
    gstType: 'EXCLUSIVE',
    category: 'Medical Devices',
  },
  {
    hsnCode: '2106',
    description: 'Food preparations not elsewhere specified or included',
    gstRate: 18,
    gstType: 'EXCLUSIVE',
    category: 'Nutraceuticals',
  },
  {
    hsnCode: '3304',
    description: 'Beauty or make-up preparations and preparations for the care of the skin',
    gstRate: 18,
    gstType: 'EXCLUSIVE',
    category: 'Cosmetics',
  },
  {
    hsnCode: '30049099',
    description: 'Other medicaments containing pharmaceutical substances',
    gstRate: 12,
    gstType: 'EXCLUSIVE',
    category: 'Pharmaceuticals',
  },
  {
    hsnCode: '30049090',
    description: 'Medicaments containing pharmaceutical substances - other',
    gstRate: 12,
    gstType: 'EXCLUSIVE',
    category: 'Pharmaceuticals',
  },
  {
    hsnCode: '30049010',
    description: 'Medicaments containing pharmaceutical substances - Ayurvedic',
    gstRate: 12,
    gstType: 'EXCLUSIVE',
    category: 'Ayurvedic',
  },
  {
    hsnCode: '30049020',
    description: 'Medicaments containing pharmaceutical substances - Homeopathic',
    gstRate: 12,
    gstType: 'EXCLUSIVE',
    category: 'Homeopathic',
  },
  {
    hsnCode: '30049030',
    description: 'Medicaments containing pharmaceutical substances - Unani',
    gstRate: 12,
    gstType: 'EXCLUSIVE',
    category: 'Unani',
  },
  {
    hsnCode: '30049040',
    description: 'Medicaments containing pharmaceutical substances - Siddha',
    gstRate: 12,
    gstType: 'EXCLUSIVE',
    category: 'Siddha',
  },
  {
    hsnCode: '30049050',
    description: 'Medicaments containing pharmaceutical substances - Biotech',
    gstRate: 12,
    gstType: 'EXCLUSIVE',
    category: 'Biotech',
  },
  {
    hsnCode: '30049060',
    description: 'Medicaments containing pharmaceutical substances - Vaccines',
    gstRate: 5,
    gstType: 'EXCLUSIVE',
    category: 'Vaccines',
  },
  {
    hsnCode: '30049070',
    description: 'Medicaments containing pharmaceutical substances - Blood products',
    gstRate: 12,
    gstType: 'EXCLUSIVE',
    category: 'Blood Products',
  },
  {
    hsnCode: '30049080',
    description: 'Medicaments containing pharmaceutical substances - Diagnostic reagents',
    gstRate: 12,
    gstType: 'EXCLUSIVE',
    category: 'Diagnostics',
  },
  {
    hsnCode: '3005',
    description: 'Wadding, gauze, bandages and similar articles',
    gstRate: 12,
    gstType: 'EXCLUSIVE',
    category: 'Medical Supplies',
  },
  {
    hsnCode: '4015',
    description: 'Articles of apparel and clothing accessories, of vulcanized rubber',
    gstRate: 18,
    gstType: 'EXCLUSIVE',
    category: 'Medical Supplies',
  },
  {
    hsnCode: '3926',
    description: 'Other articles of plastics',
    gstRate: 18,
    gstType: 'EXCLUSIVE',
    category: 'Medical Supplies',
  },
];

async function seedHSN() {
  console.log('🚀 Seeding HSN Master...');

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const hsn of hsnCodes) {
    try {
      const existing = await prisma.hSNMaster.findUnique({
        where: { hsnCode: hsn.hsnCode },
      });

      if (existing) {
        // Update if exists but inactive
        if (!existing.isActive) {
          await prisma.hSNMaster.update({
            where: { hsnCode: hsn.hsnCode },
            data: {
              description: hsn.description,
              defaultGstRate: hsn.gstRate,
              gstType: hsn.gstType,
              category: hsn.category,
              isActive: true,
            },
          });
          updated++;
          console.log(`✅ Updated: ${hsn.hsnCode} - ${hsn.description}`);
        } else {
          skipped++;
          console.log(`⏭️  Skipped (already active): ${hsn.hsnCode}`);
        }
      } else {
        // Create new
        await prisma.hSNMaster.create({
          data: {
            hsnCode: hsn.hsnCode,
            description: hsn.description,
            defaultGstRate: hsn.gstRate,
            gstType: hsn.gstType,
            category: hsn.category,
            isActive: true,
          },
        });
        created++;
        console.log(`✅ Created: ${hsn.hsnCode} - ${hsn.description}`);
      }
    } catch (error: any) {
      console.error(`❌ Error processing ${hsn.hsnCode}:`, error.message);
    }
  }

  console.log('');
  console.log('📊 Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${hsnCodes.length}`);
  console.log('');
  console.log('✅ HSN Master seeding completed!');
}

seedHSN()
  .then(() => {
    console.log('✅ Seed completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
