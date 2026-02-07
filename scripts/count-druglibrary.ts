import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const c = await prisma.drugLibrary.count();
  console.log("DrugLibrary total rows:", c);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
