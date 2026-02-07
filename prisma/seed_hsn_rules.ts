import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // wipe + insert starter rules (edit anytime)
  await (prisma as any).hsnRule.deleteMany({});

  await (prisma as any).hsnRule.createMany({
    data: [
      // Vaccines / immunologicals
      { priority: 10, isActive: true, matchField: "brandName", matchType: "contains", pattern: "vaccine", hsnCode: "30022011", gstRate: 5, reason: "Immunological/vaccine keyword" },
      { priority: 12, isActive: true, matchField: "composition", matchType: "contains", pattern: "vaccine", hsnCode: "30022011", gstRate: 5, reason: "Immunological/vaccine keyword" },

      // Insulin
      { priority: 20, isActive: true, matchField: "salts", matchType: "contains", pattern: "insulin", hsnCode: "30043110", gstRate: 5, reason: "Contains insulin" },
      { priority: 21, isActive: true, matchField: "composition", matchType: "contains", pattern: "insulin", hsnCode: "30043110", gstRate: 5, reason: "Contains insulin" },

      // Antibiotic hint (you can expand this list)
      { priority: 30, isActive: true, matchField: "salts", matchType: "regex", pattern: "(amox|azith|cef|cipro|doxy|levo|metro|clav|amoxicillin|azithromycin|ceftriaxone|ciprofloxacin)", hsnCode: "30042011", gstRate: 5, reason: "Antibiotic pattern match" },

      // Default retail medicaments (fallback)
      { priority: 999, isActive: true, matchField: "dosageForm", matchType: "regex", pattern: "(tablet|capsule|syrup|injection|ointment|cream|drops)", hsnCode: "30049079", gstRate: 12, reason: "Fallback for measured-dose medicaments" },
    ],
  });

  console.log("✅ Seeded HSN rules");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => prisma.$disconnect());
