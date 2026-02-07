// Invoice number generation utility
import { prisma } from "@/server/prisma";

/**
 * Generate invoice number in format: PREFIX/YY-YY/NNNN
 * Example: INV/24-25/0001
 */
export async function generateInvoiceNumber(gstinId: number): Promise<string> {
  const gstin = await prisma.orgGstin.findUnique({
    where: { id: gstinId },
  });

  if (!gstin) {
    throw new Error("GSTIN not found");
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const nextYear = currentYear + 1;
  const yearRange = `${currentYear.toString().slice(-2)}-${nextYear.toString().slice(-2)}`;

  // Use transaction to ensure atomic increment
  const updated = await prisma.orgGstin.update({
    where: { id: gstinId },
    data: { nextInvoiceNo: { increment: 1 } },
    select: { nextInvoiceNo: true, invoicePrefix: true },
  });

  const invoiceNumber = `${updated.invoicePrefix}/${yearRange}/${String(updated.nextInvoiceNo - 1).padStart(4, "0")}`;

  return invoiceNumber;
}
