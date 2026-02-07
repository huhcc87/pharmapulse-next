/**
 * Map HSN and GST rate onto Product table using a mapping file:
 * - India_Pharma_HSN_GST.csv or .xlsx (your curated mapping)
 *
 * Usage:
 *   npx ts-node scripts/map-hsn-gst.ts ./data/India_Pharma_HSN_GST.xlsx
 *
 * Matching strategy (edit as needed):
 * - by internalCode if present in map
 * - else by normalized name
 */
import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import pLimit from "p-limit";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalizeName(s: any) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readRows(file: string) {
  const ext = path.extname(file).toLowerCase();
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Provide mapping file path.");
  if (!fs.existsSync(file)) throw new Error("File not found: " + file);

  const rows = await readRows(file);
  console.log("Mapping rows:", rows.length);

  // Build maps
  const byCode = new Map<string, { hsn: string; gstRate: number }>();
  const byName = new Map<string, { hsn: string; gstRate: number }>();

  for (const r of rows) {
    const code = String(r.internalCode || r.code || r.NMED || r.nmed || "").trim();
    const name = String(r.name || r.Name || r.drug_name || "").trim();
    const hsn = String(r.hsn || r.HSN || "").trim();
    const gstRateRaw = r.gstRate || r.GST || r.gst || "";
    const gstRate = gstRateRaw === "" ? NaN : Number(gstRateRaw);

    if (!hsn && !Number.isFinite(gstRate)) continue;

    const payload = { hsn: hsn || "", gstRate: Number.isFinite(gstRate) ? gstRate : NaN };

    if (code) byCode.set(code, payload);
    if (name) byName.set(normalizeName(name), payload);
  }

  const all = await prisma.product.findMany({
    select: { id: true, name: true, internalCode: true, hsnCode: true, gstRate: true },
  });

  console.log("Products:", all.length);

  const limit = pLimit(25);
  let updated = 0;

  await Promise.all(
    all.map((p) =>
      limit(async () => {
        const code = p.internalCode || "";
        const nm = normalizeName(p.name);
        const hit = (code && byCode.get(code)) || byName.get(nm);

        if (!hit) return;

        const nextHSN = hit.hsn || p.hsnCode || null;
        const nextGST = Number.isFinite(hit.gstRate) ? hit.gstRate : (p.gstRate ? Number(p.gstRate) : null);

        // Skip if no change
        const curHSN = p.hsnCode || null;
        const curGST = p.gstRate == null ? null : Number(p.gstRate);

        if (nextHSN === curHSN && nextGST === curGST) return;

        await prisma.product.update({
          where: { id: p.id },
          data: {
            hsnCode: nextHSN,
            gstRate: nextGST,
          },
        });
        updated++;
      })
    )
  );

  console.log("Updated:", updated);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
