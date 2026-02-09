// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting seed process...');

  // First, clear existing audit logs
  try {
    const deletedCount = await prisma.auditLog.deleteMany({});
    console.log(`✅ Cleared ${deletedCount.count} existing audit logs`);
  } catch (error) {
    console.log('⚠️ No audit logs to clear or error clearing:', error.message);
  }

  // Try to seed audit logs with correct field names
  try {
    console.log('Creating sample audit logs...');

    // Create first audit log - using the CORRECT field names from your schema
    const firstLog = await prisma.auditLog.create({
      data: {
        tenantId: 1, // Required
        userId: null, // Optional - use null since we don't have a user yet
        action: 'APPLICATION_INITIALIZED',
        entity: 'SYSTEM',
        beforeJson: null,
        afterJson: JSON.stringify({ 
          version: '1.0.0', 
          environment: 'development',
          timestamp: new Date().toISOString() 
        }),
        ipAddress: '127.0.0.1',
        userAgent: 'Terminal/Seed',
      },
    });

    console.log('✅ First audit log created:', firstLog.id);

    // Create second audit log
    const secondLog = await prisma.auditLog.create({
      data: {
        tenantId: 1,
        userId: null, // Would be actual user ID in production
        action: 'SEED_COMPLETED',
        entity: 'SEED_PROCESS',
        beforeJson: null,
        afterJson: JSON.stringify({
          message: 'Database seeding completed successfully',
          timestamp: new Date().toISOString()
        }),
        ipAddress: '127.0.0.1',
        userAgent: 'Terminal/Seed',
      },
    });

    console.log('✅ Second audit log created:', secondLog.id);
    console.log('✅ Successfully seeded audit logs');
    
  } catch (error: any) {
    console.log('⚠️ Could not seed audit logs:', error.message);
    console.log('Error details:', error);
    console.log('Skipping audit log seeding...');
  }

  // Now run your other seed functions
  console.log('Running other seed functions...');
  
  // Uncomment these if you have them
  // await seedDrugLibrary();
  // await seedHSN();
  // await seedPosIndia();

  console.log('✅ All seed operations completed!');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });