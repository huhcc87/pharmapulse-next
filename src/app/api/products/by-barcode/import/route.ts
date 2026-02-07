import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { validateBarcode } from "@/lib/barcodes/validate";
import { NextResponse } from "next/server";

type Row = Record<string, any>;

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const { searchParams } = new URL(req.url);
    const allowOverwrite = searchParams.get("allowOverwrite") === "true";

    const parsed = Papa.parse<Row>(body, { header: true, skipEmptyLines: true });
    if (parsed.errors?.length) {
      return NextResponse.json(
        { error: `CSV parse error: ${parsed.errors[0].message}` },
        { status: 400 }
      );
    }

    const rows = parsed.data || [];
    const imported: any[] = [];
    const errors: any[] = [];

    // Chunking for performance (500-1000 rows per transaction)
    const CHUNK_SIZE = 500;

    for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
      const chunk = rows.slice(start, start + CHUNK_SIZE);

      // Transaction per chunk
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < chunk.length; i++) {
          const rowIndex = start + i + 2; // +2 (header row + 1-based)
          const row = chunk[i];

          // Support multiple matching strategies
          const productId = row.product_id ? parseInt(String(row.product_id)) : null;
          const internalCode = String(row.internal_code || row.internalCode || "").trim();
          const productName = String(row.product_name || row.name || "").trim();
          const manufacturer = String(row.manufacturer || "").trim();
          const packSize = String(row.pack_size || row.packSize || "").trim();
          const barcodeRaw = String(row.barcode || row.barcodeValue || "").trim();

          if (!barcodeRaw) {
            errors.push({ row: rowIndex, error: "Missing barcode", data: row });
            continue;
          }

          const v = validateBarcode(barcodeRaw);
          if (!v.ok) {
            errors.push({ row: rowIndex, error: v.error, barcode: barcodeRaw });
            continue;
          }

          // Find product by priority: product_id > internal_code > name+manufacturer+packSize
          let product = null;
          if (productId) {
            product = await tx.product.findUnique({ where: { id: productId } });
          }
          if (!product && internalCode) {
            product = await tx.product.findUnique({ where: { internalCode } });
          }
          if (!product && productName) {
            // Try to match by name, optionally with manufacturer and packSize
            const where: any = { name: productName };
            if (manufacturer) {
              product = await tx.product.findFirst({
                where: { name: productName, manufacturer },
              });
            }
            if (!product) {
              product = await tx.product.findFirst({ where });
            }
          }

          if (!product) {
            errors.push({
              row: rowIndex,
              error: "Product not found",
              product_name: productName,
              internal_code: internalCode,
              barcode: barcodeRaw,
            });
            continue;
          }

          // Check if barcode is already assigned to another product
          const existing = await tx.product.findFirst({
            where: {
              barcodeTypeEnum: v.type === "INMED" ? undefined : (v.type as any),
              barcodeValue: v.normalized,
              id: { not: product.id },
            },
          });

          if (existing && !allowOverwrite) {
            errors.push({
              row: rowIndex,
              error: `Barcode ${v.normalized} already assigned to product ID ${existing.id}`,
              product_name: productName,
              barcode: v.normalized,
            });
            continue;
          }

          try {
            await tx.product.update({
              where: { id: product.id },
              data: {
                barcodeValue: v.normalized,
                barcodeTypeEnum: v.type === "INMED" ? undefined : (v.type as any),
                barcodeSource: "import",
                barcodeVerified: false,
              },
            });
            imported.push({
              row: rowIndex,
              product_id: product.id,
              product_name: product.name,
              barcode: v.normalized,
              type: v.type,
            });
          } catch (e: any) {
            errors.push({
              row: rowIndex,
              error: e?.message || "Update failed",
              product_name: productName,
              barcode: v.normalized,
            });
          }
        }
      });
    }

    // Generate CSV responses
    const importedCsv = Papa.unparse(imported, { header: true });
    const errorsCsv = Papa.unparse(errors, { header: true });

    return NextResponse.json({
      importedCount: imported.length,
      errorCount: errors.length,
      imported,
      errors,
      importedCsv,
      errorsCsv,
    });
  } catch (error: any) {
    console.error("Import error:", error);
    return NextResponse.json({ error: error?.message || "Import failed" }, { status: 500 });
  }
}
