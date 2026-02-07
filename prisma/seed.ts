import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const items = [
    {
      name: "Vicks NyQuil Cough",
      barcodeValue: "0323900014329",
      barcodeTypeEnum: "EAN13" as const,
      sku: "VICKS-NYQUIL-001",
      category: "Cough & Cold",
      unitPrice: 150.0,
      salePrice: 150.0,
      mrp: 180.0,
    },
    {
      name: "Crocin",
      barcodeValue: "8901571012060",
      barcodeTypeEnum: "EAN13" as const,
      sku: "CROCIN-001",
      category: "Pain Relief",
      unitPrice: 25.0,
      salePrice: 25.0,
      mrp: 30.0,
    },
    {
      name: "Dolo 650 mg (Bulk)",
      barcodeValue: "40334273",
      barcodeTypeEnum: "EAN8" as const,
      sku: "DOLO-650-001",
      category: "Pain Relief",
      unitPrice: 15.0,
      salePrice: 15.0,
      mrp: 20.0,
    },
  ];

  for (const it of items) {
    // Check if product with this barcode already exists
    const existingByBarcode = await prisma.product.findFirst({
      where: {
        barcodeTypeEnum: it.barcodeTypeEnum,
        barcodeValue: it.barcodeValue,
      },
    });

    if (existingByBarcode) {
      // Update existing product by barcode
      await prisma.product.update({
        where: { id: existingByBarcode.id },
        data: {
          name: it.name,
          category: it.category,
          unitPrice: it.unitPrice,
          salePrice: it.salePrice,
          mrp: it.mrp,
          barcodeSource: "seed",
          barcodeVerified: true,
        },
      });
      console.log(`✅ Updated existing product by barcode: ${it.name} (${it.barcodeValue})`);
    } else {
      // Upsert by SKU, or create new
      await prisma.product.upsert({
        where: { sku: it.sku },
        update: {
          barcodeValue: it.barcodeValue,
          barcodeTypeEnum: it.barcodeTypeEnum,
          barcodeSource: "seed",
          barcodeVerified: true,
          name: it.name,
          category: it.category,
          unitPrice: it.unitPrice,
          salePrice: it.salePrice,
          mrp: it.mrp,
        },
        create: {
          name: it.name,
          sku: it.sku,
          category: it.category,
          unitPrice: it.unitPrice,
          salePrice: it.salePrice,
          mrp: it.mrp,
          barcodeValue: it.barcodeValue,
          barcodeTypeEnum: it.barcodeTypeEnum,
          barcodeSource: "seed",
          barcodeVerified: true,
          stockLevel: 0,
          minStock: 0,
          isRx: false,
          isActive: true,
        },
      });
      console.log(`✅ Upserted product: ${it.name} (${it.barcodeValue})`);
    }
  }

  console.log("✅ Seeded barcode test products");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
