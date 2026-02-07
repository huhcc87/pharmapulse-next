/**
 * Import your master drug library into Product table.
 * Supports Excel (.xlsx) and CSV.
 *
 * Usage:
 *   npx ts-node scripts/import-drug-library.ts ./data/Master.xlsx
 */
import path from "path";
import fs from "fs";
import XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import pLimit from "p-limit";

const prisma = new PrismaClient();

function norm(s: any) {
  return String(s ?? "").trim();
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Provide file path. Example: npx ts-node scripts/import-drug-library.ts ./data/Master.xlsx");
    process.exit(1);
  }

  if (!fs.existsSync(file)) {
    console.error("File not found:", file);
    process.exit(1);
  }

  const ext = path.extname(file).toLowerCase();
  let rows: any[] = [];

  if (ext === ".xlsx" || ext === ".xls") {
    const wb = XLSX.readFile(file);
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  } else if (ext === ".csv") {
    const wb = XLSX.readFile(file, { type: "file" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  } else {
    console.error("Unsupported file:", ext);
    process.exit(1);
  }

  console.log("Rows:", rows.length);

  const limit = pLimit(20);

  // Expected columns (adjust to your sheet):
  // name, internalCode (NMED-000001), barcode(optional), hsn(optional), gstRate(optional), salePrice(optional), mrp(optional)
  const tasks = rows.map((r) =>
    limit(async () => {
      const name = norm(r.name || r.Name || r.Drug || r.drug_name);
      if (!name) return;

      const internalCode = norm(r.internalCode || r.code || r.NMED || r.nmed);
      const barcode = norm(r.barcode || r.Barcode || r.UPC || r.EAN || "");
      const hsn = norm(r.hsn || r.HSN || "");
      const gstRate = r.gstRate || r.GST || r.gst || null;
      const salePrice = Number(r.salePrice || r.Price || r.price || r.mrp || 0) || 0;
      const mrp = Number(r.mrp || r.MRP || 0) || null;

      // Only upsert if we have a unique identifier (internalCode or barcode)
      if (internalCode || barcode) {
        await prisma.product.upsert({
          where: internalCode ? { internalCode } : { barcode: barcode! },
          update: {
            name,
            barcode: barcode || null,
            hsnCode: hsn || null,
            gstRate: gstRate == null || gstRate === "" ? null : Number(gstRate),
            salePrice,
            mrp,
            isActive: true,
          },
          create: {
            name,
            internalCode: internalCode || null,
            barcode: barcode || null,
            hsnCode: hsn || null,
            gstRate: gstRate == null || gstRate === "" ? null : Number(gstRate),
            gstType: "EXCLUSIVE",
            salePrice,
            mrp,
            isRx: false,
            isActive: true,
            sku: `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            category: "General",
            unitPrice: salePrice,
          },
        });
      } else {
        // Create new product if no unique identifier
        await prisma.product.create({
          data: {
            name,
            internalCode: internalCode || null,
            barcode: barcode || null,
            hsnCode: hsn || null,
            gstRate: gstRate == null || gstRate === "" ? null : Number(gstRate),
            gstType: "EXCLUSIVE",
            salePrice,
            mrp,
            isRx: false,
            isActive: true,
            sku: `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            category: "General",
            unitPrice: salePrice,
          },
        });
      }
    })
  );

  await Promise.all(tasks);
  console.log("Import complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
