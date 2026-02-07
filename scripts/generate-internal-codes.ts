import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function pad(n: number) {
  return String(n).padStart(6, "0");
}

async function main() {
  // Get all products missing internalCode (process in batches to avoid memory issues)
  const batchSize = 1000;
  let offset = 0;
  let totalUpdated = 0;

  // Find current max to avoid collisions
  const last = await prisma.product.findFirst({
    where: { internalCode: { not: null } },
    orderBy: { internalCode: "desc" },
    select: { internalCode: true },
  });

  let startNum = 1;
  if (last?.internalCode) {
    const match = last.internalCode.match(/^(INMED|NMED)-(\d+)$/i);
    if (match) {
      startNum = Number(match[2]) + 1;
    }
  }

  console.log(`Starting from NMED-${pad(startNum)}`);

  while (true) {
    const missing = await prisma.product.findMany({
      where: { internalCode: null },
      select: { id: true },
      take: batchSize,
      skip: offset,
      orderBy: { id: "asc" },
    });

    if (missing.length === 0) {
      break;
    }

    console.log(`Processing batch: ${offset + 1} to ${offset + missing.length}`);

    // Process in smaller chunks to avoid overwhelming the database
    const chunkSize = 100;
    for (let i = 0; i < missing.length; i += chunkSize) {
      const chunk = missing.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map((row, idx) => {
          const code = `NMED-${pad(startNum + offset + i + idx)}`;
          return prisma.product.update({
            where: { id: row.id },
            data: { internalCode: code },
          });
        })
      );
    }

    totalUpdated += missing.length;
    offset += missing.length;

    if (missing.length < batchSize) {
      break;
    }
  }

  console.log(`Done. Updated ${totalUpdated} products with internal codes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
