// prisma/seed-pos-india.ts
// Seed data for POS India Mode features

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding POS India Mode data...");

  const tenantId = 1;

  // 1. Create customers with loyalty accounts
  console.log("Creating customers...");
  const customer1 = await prisma.customer.upsert({
    where: { phone: "9876543210" },
    update: {},
    create: {
      tenantId,
      name: "Rajesh Kumar",
      phone: "9876543210",
      email: "rajesh@example.com",
      dob: new Date("1985-05-15"),
      allergies: JSON.stringify(["Paracetamol", "Penicillin"]),
      notes: "Regular customer, prefers generic medicines",
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { phone: "9876543211" },
    update: {},
    create: {
      tenantId,
      name: "Priya Sharma",
      phone: "9876543211",
      email: "priya@example.com",
      dob: new Date("1990-08-22"),
      allergies: JSON.stringify([]),
      notes: "VIP customer, frequent buyer",
    },
  });

  // Create loyalty accounts
  await prisma.loyaltyAccount.upsert({
    where: { customerId: customer1.id },
    update: {},
    create: {
      customerId: customer1.id,
      pointsBalance: 250,
      pointsRate: 1.0,
      minRedemption: 100,
    },
  });

  await prisma.loyaltyAccount.upsert({
    where: { customerId: customer2.id },
    update: {},
    create: {
      customerId: customer2.id,
      pointsBalance: 500,
      pointsRate: 1.0,
      minRedemption: 100,
    },
  });

  console.log("✅ Created 2 customers with loyalty accounts");

  // 2. Create products with batches
  console.log("Creating products with batches...");
  
  // Find or create products
  const products = [
    {
      sku: "CROCIN-500",
      name: "Crocin 500mg Tablet",
      category: "Pain Relief",
      manufacturer: "GSK",
      hsnCode: "3004",
      unitPrice: 25.0,
      salePrice: 30.0,
      mrp: 35.0,
      gstRate: 12.0,
      stockLevel: 100,
      minStock: 20,
      batches: [
        {
          batchCode: "BATCH-001",
          expiryDate: new Date("2026-12-31"),
          quantityOnHand: 50,
          purchaseCost: 20.0,
        },
        {
          batchCode: "BATCH-002",
          expiryDate: new Date("2027-06-30"),
          quantityOnHand: 50,
          purchaseCost: 20.0,
        },
      ],
    },
    {
      sku: "AUGMENTIN-625",
      name: "Augmentin 625mg Tablet",
      category: "Antibiotic",
      manufacturer: "GSK",
      hsnCode: "3004",
      unitPrice: 150.0,
      salePrice: 180.0,
      mrp: 200.0,
      gstRate: 12.0,
      stockLevel: 50,
      minStock: 10,
      batches: [
        {
          batchCode: "BATCH-003",
          expiryDate: new Date("2026-08-15"),
          quantityOnHand: 30,
          purchaseCost: 140.0,
        },
        {
          batchCode: "BATCH-004",
          expiryDate: new Date("2027-01-20"),
          quantityOnHand: 20,
          purchaseCost: 140.0,
        },
      ],
    },
    {
      sku: "DOLO-650",
      name: "Dolo 650mg Tablet",
      category: "Pain Relief",
      manufacturer: "Micro Labs",
      hsnCode: "3004",
      unitPrice: 20.0,
      salePrice: 25.0,
      mrp: 30.0,
      gstRate: 12.0,
      stockLevel: 200,
      minStock: 50,
      batches: [
        {
          batchCode: "BATCH-005",
          expiryDate: new Date("2026-10-30"),
          quantityOnHand: 100,
          purchaseCost: 18.0,
        },
        {
          batchCode: "BATCH-006",
          expiryDate: new Date("2027-03-15"),
          quantityOnHand: 100,
          purchaseCost: 18.0,
        },
      ],
    },
    {
      sku: "COUGH-SYRUP",
      name: "Cough Syrup 100ml",
      category: "Cough & Cold",
      manufacturer: "Cipla",
      hsnCode: "3004",
      unitPrice: 80.0,
      salePrice: 100.0,
      mrp: 120.0,
      gstRate: 12.0,
      stockLevel: 30,
      minStock: 10,
      batches: [
        {
          batchCode: "BATCH-007",
          expiryDate: new Date("2026-11-20"),
          quantityOnHand: 30,
          purchaseCost: 75.0,
        },
      ],
    },
    {
      sku: "VITAMIN-D",
      name: "Vitamin D3 60k IU",
      category: "Vitamins",
      manufacturer: "Sun Pharma",
      hsnCode: "3004",
      unitPrice: 120.0,
      salePrice: 150.0,
      mrp: 180.0,
      gstRate: 12.0,
      stockLevel: 40,
      minStock: 10,
      batches: [
        {
          batchCode: "BATCH-008",
          expiryDate: new Date("2027-05-10"),
          quantityOnHand: 40,
          purchaseCost: 110.0,
        },
      ],
    },
  ];

  for (const productData of products) {
    const { batches, ...productInfo } = productData;
    
    const product = await prisma.product.upsert({
      where: { sku: productData.sku },
      update: {
        ...productInfo,
        stockLevel: productData.stockLevel,
      },
      create: productInfo,
    });

    // Create batches
    for (const batchData of batches) {
      await prisma.batch.upsert({
        where: {
          productId_batchCode: {
            productId: product.id,
            batchCode: batchData.batchCode,
          },
        },
        update: batchData,
        create: {
          productId: product.id,
          ...batchData,
        },
      });
    }
  }

  console.log("✅ Created 5 products with batches");

  // 3. Create sample prescriptions
  console.log("Creating sample prescriptions...");
  
  const prescription1 = await prisma.prescription.create({
    data: {
      tenantId,
      customerId: customer1.id,
      doctorName: "Dr. Anil Kumar",
      doctorPhone: "9876543200",
      date: new Date(),
      status: "PENDING",
      lines: {
        create: [
          {
            medicationName: "Crocin 500mg",
            dosage: "1 tablet",
            frequency: "Twice daily",
            duration: "5 days",
            quantity: 10,
            status: "PENDING",
          },
          {
            medicationName: "Cough Syrup",
            dosage: "10ml",
            frequency: "Three times daily",
            duration: "7 days",
            quantity: 1,
            status: "PENDING",
          },
        ],
      },
    },
  });

  console.log("✅ Created sample prescription");

  console.log("🎉 POS India Mode seed data completed!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


