// Invoice Management Advanced
// Templates, recurring invoices, approval workflow, dispute management

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface InvoiceTemplateData {
  name: string;
  description?: string;
  templateData: {
    lineItems?: Array<{
      productId?: number;
      productName: string;
      quantity: number;
      unitPrice: number;
      hsnCode?: string;
    }>;
    defaultTerms?: string;
    defaultNotes?: string;
    taxSettings?: {
      gstType: string;
      placeOfSupply?: string;
    };
  };
  defaultCustomerId?: string;
  defaultTerms?: string;
  defaultNotes?: string;
  isDefault?: boolean;
}

export interface RecurringInvoiceData {
  name: string;
  description?: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  interval: number;
  startDate: Date;
  endDate?: Date;
  templateId?: string;
  invoiceData: any;
  customerId?: string;
}

/**
 * Create invoice template
 */
export async function createInvoiceTemplate(
  tenantId: string,
  data: InvoiceTemplateData
): Promise<any> {
  try {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.invoiceTemplate.updateMany({
        where: {
          tenantId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const template = await prisma.invoiceTemplate.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description || null,
        templateData: JSON.parse(JSON.stringify(data.templateData)),
        defaultCustomerId: data.defaultCustomerId || null,
        defaultTerms: data.defaultTerms || null,
        defaultNotes: data.defaultNotes || null,
        isDefault: data.isDefault || false,
        isActive: true,
      },
    });

    return template;
  } catch (error: any) {
    console.error("Create invoice template error:", error);
    throw error;
  }
}

/**
 * Create recurring invoice
 */
export async function createRecurringInvoice(
  tenantId: string,
  data: RecurringInvoiceData
): Promise<any> {
  try {
    // Calculate next run date
    const nextRunDate = calculateNextRunDate(data.startDate, data.frequency, data.interval);

    const recurring = await prisma.recurringInvoice.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description || null,
        frequency: data.frequency,
        interval: data.interval,
        startDate: data.startDate,
        endDate: data.endDate || null,
        nextRunDate,
        templateId: data.templateId || null,
        invoiceData: JSON.parse(JSON.stringify(data.invoiceData)),
        customerId: data.customerId || null,
        status: "ACTIVE",
        invoicesGenerated: 0,
      },
    });

    return recurring;
  } catch (error: any) {
    console.error("Create recurring invoice error:", error);
    throw error;
  }
}

/**
 * Process recurring invoices (should be called by cron)
 */
export async function processRecurringInvoices(tenantId?: string): Promise<number> {
  try {
    const where: any = {
      status: "ACTIVE",
      nextRunDate: {
        lte: new Date(),
      },
    };
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const recurringInvoices = await prisma.recurringInvoice.findMany({
      where,
    });

    let processed = 0;

    for (const recurring of recurringInvoices) {
      // Check if end date has passed
      if (recurring.endDate && new Date() > recurring.endDate) {
        await prisma.recurringInvoice.update({
          where: { id: recurring.id },
          data: { status: "COMPLETED" },
        });
        continue;
      }

      // Generate invoice (this would call your invoice creation logic)
      // For now, just update the recurring invoice
      const nextRunDate = calculateNextRunDate(
        recurring.nextRunDate,
        recurring.frequency as any,
        recurring.interval
      );

      await prisma.recurringInvoice.update({
        where: { id: recurring.id },
        data: {
          nextRunDate,
          invoicesGenerated: recurring.invoicesGenerated + 1,
        },
      });

      processed++;
    }

    return processed;
  } catch (error: any) {
    console.error("Process recurring invoices error:", error);
    throw error;
  }
}

/**
 * Create invoice dispute
 */
export async function createInvoiceDispute(
  tenantId: string,
  invoiceId: number,
  data: {
    disputeType: string;
    reason: string;
    description?: string;
    requestedAdjustmentPaise?: number;
  }
): Promise<any> {
  try {
    const dispute = await prisma.invoiceDispute.create({
      data: {
        tenantId,
        invoiceId,
        disputeType: data.disputeType,
        reason: data.reason,
        description: data.description || null,
        requestedAdjustmentPaise: data.requestedAdjustmentPaise || null,
        status: "OPEN",
      },
    });

    // Update invoice status if needed
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "DISPUTED" },
    });

    return dispute;
  } catch (error: any) {
    console.error("Create invoice dispute error:", error);
    throw error;
  }
}

/**
 * Resolve invoice dispute
 */
export async function resolveInvoiceDispute(
  tenantId: string,
  disputeId: string,
  data: {
    resolution: string;
    approvedAdjustmentPaise?: number;
    resolvedBy: string;
  }
): Promise<any> {
  try {
    const dispute = await prisma.invoiceDispute.update({
      where: {
        id: disputeId,
        tenantId,
      },
      data: {
        status: "RESOLVED",
        resolution: data.resolution,
        approvedAdjustmentPaise: data.approvedAdjustmentPaise || null,
        resolvedBy: data.resolvedBy,
        resolvedAt: new Date(),
      },
    });

    // Update invoice if adjustment approved
    if (data.approvedAdjustmentPaise) {
      // This would trigger invoice adjustment logic
      // For now, just update invoice status
      await prisma.invoice.update({
        where: { id: dispute.invoiceId },
        data: { status: "ISSUED" },
      });
    }

    return dispute;
  } catch (error: any) {
    console.error("Resolve invoice dispute error:", error);
    throw error;
  }
}

function calculateNextRunDate(
  startDate: Date,
  frequency: string,
  interval: number
): Date {
  const next = new Date(startDate);

  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + interval);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + interval * 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + interval);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + interval * 3);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + interval);
      break;
  }

  return next;
}
