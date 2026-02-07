import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function norm(s?: string | null) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldValue(drug: any, field: string) {
  if (field === "dosageForm") return drug.dosageForm || null;
  if (field === "composition") return drug.fullComposition;
  if (field === "brandName") return drug.brandName;
  if (field === "salts") return drug.salts;
  return null;
}

function matches(value: string, matchType: string, pattern: string) {
  if (matchType === "equals") return value === norm(pattern);
  if (matchType === "contains") return value.includes(norm(pattern));
  if (matchType === "regex") {
    const re = new RegExp(pattern, "i");
    return re.test(value);
  }
  return false;
}

async function main() {
  const rules = await (prisma as any).hsnRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "asc" }
  });

  const drugs = await prisma.drugLibrary.findMany({
    // Note: This script needs updating - DrugLibrary model doesn't have hsnCode field
    select: { id: true, brandName: true, salts: true, fullComposition: true }
  });

  let mapped = 0;
  let unmapped = 0;

  for (const d of drugs) {
    let found: any = null;

    for (const r of rules) {
      const raw = fieldValue(d, r.matchField);
      const v = norm(raw);
      if (!v) continue;
      if (matches(v, r.matchType, r.pattern)) {
        found = r;
        break;
      }
    }

    if (found) {
      // Note: DrugLibrary model doesn't have hsnCode field - this script needs updating
      // await prisma.drugLibrary.update({
      //   where: { id: d.id },
      //   data: {
      //     // hsnCode: found.hsnCode,
      //     gstPercent: found.gstRate
      //   }
      // });
      mapped++;
    } else {
      unmapped++;
    }
  }

  console.log(`✅ Mapped: ${mapped}`);
  console.log(`⚠️ Unmapped: ${unmapped} (needs manual rules)`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => prisma.$disconnect());
