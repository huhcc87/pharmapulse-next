// scripts/import-drug-library.ts
console.log("🔥 RUNNING UPDATED import-drug-library.ts");

import path from "path";
import XLSX from "xlsx";
import pLimit from "p-limit";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canon(s: string) {
  return (s || "").replace(/\s+/g, " ").trim();
}

function get(row: any, keys: string[]) {
  const map: Record<string, any> = {};
  for (const k of Object.keys(row)) map[String(k).toLowerCase().trim()] = row[k];

  for (const k of keys) {
    const v = map[k.toLowerCase().trim()];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function getArg(name: string, fallback: number) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return fallback;
  const v = Number(arg.split("=")[1]);
  return Number.isFinite(v) ? v : fallback;
}

/**
 * Normalizes qr_code values into INMED-000001 format (6 digits)
 */
function normalizeQrCode(raw: string) {
  const s = canon(raw);
  if (!s) return "";

  if (/inmed/i.test(s)) {
    const digits = s.replace(/[^0-9]/g, "");
    if (!digits) return "";
    const padded = digits.padStart(6, "0");
    return `INMED-${padded}`;
  }

  const digitsOnly = s.replace(/[^0-9]/g, "");
  if (!digitsOnly) return "";
  const padded = digitsOnly.padStart(6, "0");
  return `INMED-${padded}`;
}

function parseFloatOrNull(raw: string) {
  const s = canon(raw);
  if (!s) return null;
  const cleaned = s.replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// For price columns like "₹223.42"
function parseInrToFloat(raw: string) {
  const s = canon(raw);
  if (!s) return null;
  const cleaned = s.replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const filePath = path.join(
    process.cwd(),
    "Master Excel-india_allopathy_medicines_253973_fixed.xlsx"
  );

  const wb = XLSX.readFile(filePath);

  const preferred = "All_Drugs";
  const sheetName = wb.SheetNames.includes(preferred) ? preferred : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];

  console.log("Using sheet:", sheetName);

  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  const limit = getArg("limit", rows.length);
  const concurrency = getArg("concurrency", 6);
  const start = getArg("start", 0);
  const end = Math.min(start + limit, rows.length);
  const slice = rows.slice(start, end);

  console.log("Rows found:", rows.length);
  console.log("Rows importing:", slice.length, `(start=${start}, end=${end})`);
  console.log("Concurrency:", concurrency);

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  const limiter = pLimit(concurrency);

  await Promise.all(
    slice.map((row, i) =>
      limiter(async () => {
        const idx = start + i;

        try {
          const brandName = canon(
            get(row, ["brand_name", "brand name", "brand", "product name", "product", "name"])
          );

          const manufacturer = canon(
            get(row, ["manufacturer", "mfr", "company", "marketer", "manufactured by"])
          );

          const packSize = canon(get(row, ["pack_size", "pack size", "pack", "size"]));

          const fullComposition = canon(
            get(row, ["full_composition", "full composition", "composition", "compositions"])
          );

          const salts = canon(get(row, ["salts"])) || (fullComposition ? fullComposition : "");

          const category = canon(get(row, ["category", "dosage form", "form", "type"])) || null;

          const schedule = canon(get(row, ["schedule"])) || null;
          const rxOtc = canon(get(row, ["rx_otc", "rx/otc", "rx otc"])) || null;

          // ✅ PRICE -> dpcoCeilingPriceInr (Float)
          const dpcoCeilingPriceInr = parseInrToFloat(
            get(row, [
              "dpco_ceiling_price_inr",
              "dpco ceiling price inr",
              "price_inr",
              "price",
              "mrp",
              "cost",
            ])
          );

          // ✅ GST percent
          const gstPercent = parseFloatOrNull(
            get(row, ["gst_percent", "gst", "gst %", "gst rate"])
          );

          // ✅ QR
          const qrCodeRaw = get(row, ["qr_code", "qr code", "qrcode", "code"]);
          const qrCode = normalizeQrCode(qrCodeRaw);

          if (!brandName) {
            skipped++;
            return;
          }
          if (!qrCode) {
            skipped++;
            return;
          }

          const qrPayload = `https://airesearchscholar.com/pharma/drug/${qrCode}`;

          await prisma.drugLibrary.upsert({
            where: { qrCode },
            update: {
              brandName,
              brandNameNorm: norm(brandName),

              manufacturer: manufacturer || null,
              manufacturerNorm: manufacturer ? norm(manufacturer) : null,

              packSize: packSize || null,
              packSizeNorm: packSize ? norm(packSize) : null,

              fullComposition: fullComposition || null,
              compositionNorm: fullComposition ? norm(fullComposition) : null,

              salts: salts || null,
              saltsNorm: salts ? norm(salts) : null,

              category: category || null,
              type: category || null,

              gstPercent: gstPercent,
              dpcoCeilingPriceInr: dpcoCeilingPriceInr,

              schedule,
              rxOtc,

              qrPayload,
            },
            create: {
              qrCode,
              qrPayload,

              brandName,
              brandNameNorm: norm(brandName),

              manufacturer: manufacturer || null,
              manufacturerNorm: manufacturer ? norm(manufacturer) : null,

              packSize: packSize || null,
              packSizeNorm: packSize ? norm(packSize) : null,

              fullComposition: fullComposition || null,
              compositionNorm: fullComposition ? norm(fullComposition) : null,

              salts: salts || null,
              saltsNorm: salts ? norm(salts) : null,

              category: category || null,
              type: category || null,

              gstPercent: gstPercent,
              dpcoCeilingPriceInr: dpcoCeilingPriceInr,

              schedule,
              rxOtc,
            },
          });

          imported++;
          if (imported % 500 === 0) {
            console.log(
              `Imported: ${imported} | Skipped: ${skipped} | Failed: ${failed} | idx=${idx} | lastQR=${qrCode}`
            );
          }
        } catch (e: any) {
          failed++;
          console.error(`❌ Row failed at index ${idx}`);
          console.error(e?.message ?? e);
        }
      })
    )
  );

  console.log("✅ Import complete");
  console.log({ imported, skipped, failed, start, end });
}

main()
  .catch((e) => {
    console.error("❌ Import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
