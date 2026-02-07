// scripts/verify-customer-schema.ts
// Verify that Customer table has all required columns

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Verifying Customer table schema...\n");

  try {
    // Check database connection
    const dbUrl = process.env.DATABASE_URL || "NOT SET";
    const maskedUrl = dbUrl.includes("@") 
      ? dbUrl.replace(/(:\/\/[^:]+:)[^@]+(@)/, "$1***$2")
      : dbUrl;
    console.log("📊 DATABASE_URL:", maskedUrl);
    console.log("📊 Provider:", dbUrl.includes("postgres") ? "PostgreSQL" : "Unknown");
    console.log("");

    // Query actual database columns
    const columns = await prisma.$queryRaw<Array<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>>`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      ORDER BY ordinal_position;
    `;

    console.log("📋 Actual columns in 'customers' table:");
    console.log("─".repeat(60));
    columns.forEach((col) => {
      console.log(`  ${col.column_name.padEnd(20)} ${col.data_type.padEnd(15)} nullable: ${col.is_nullable}`);
    });
    console.log("");

    // Check for required fields
    const requiredFields = ["name", "phone", "email", "dob", "allergies", "notes", "tenant_id"];
    const existingFields = columns.map((c) => c.column_name);
    
    console.log("✅ Required fields check:");
    requiredFields.forEach((field) => {
      const exists = existingFields.includes(field);
      const status = exists ? "✅" : "❌";
      console.log(`  ${status} ${field}`);
    });

    // Test creating a customer (dry run - will rollback)
    console.log("\n🧪 Testing customer creation (dry run)...");
    try {
      await prisma.$transaction(async (tx) => {
        const testCustomer = await tx.customer.create({
          data: {
            name: "Test Customer",
            phone: null,
            email: null,
          },
        });
        // Rollback
        await tx.customer.delete({ where: { id: testCustomer.id } });
        console.log("✅ Customer creation test passed!");
      });
    } catch (testError: any) {
      console.error("❌ Customer creation test failed:");
      console.error("   Error:", testError.message);
      if (testError.message?.includes("Unknown argument")) {
        const fieldMatch = testError.message.match(/Unknown argument ['`]([^'`]+)['`]/);
        if (fieldMatch) {
          console.error(`   Missing field: ${fieldMatch[1]}`);
        }
      }
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();


