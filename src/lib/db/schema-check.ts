/**
 * Dev-only schema check utilities
 * Checks database schema consistency with Prisma schema
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SchemaCheckResult {
  columnExists: boolean;
  error?: string;
  message: string;
}

/**
 * Check if mrp column exists in inventory_items table
 * Only runs in development mode
 */
export async function checkInventoryItemsMrpColumn(): Promise<SchemaCheckResult> {
  // Only check in development
  if (process.env.NODE_ENV === 'production') {
    return {
      columnExists: true, // Assume OK in production
      message: 'Schema check skipped in production',
    };
  }

  try {
    // Query information_schema to check if mrp column exists
    const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'inventory_items' 
        AND column_name = 'mrp'
        AND table_schema = current_schema()
    `;

    const columnExists = result.length > 0;

    if (!columnExists) {
      return {
        columnExists: false,
        message: 'Column inventory_items.mrp does not exist. Please run migration: add_mrp_to_inventory_items.sql',
      };
    }

    return {
      columnExists: true,
      message: 'Column inventory_items.mrp exists ✓',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      columnExists: false,
      error: errorMessage,
      message: `Schema check failed: ${errorMessage}. Please run migration: add_mrp_to_inventory_items.sql`,
    };
  }
}

/**
 * Check schema consistency for inventory items
 * Returns a warning message if schema mismatch detected (dev only)
 */
export async function validateInventoryItemsSchema(): Promise<string | null> {
  if (process.env.NODE_ENV === 'production') {
    return null; // Skip in production
  }

  const check = await checkInventoryItemsMrpColumn();
  
  if (!check.columnExists) {
    console.warn('⚠️  [Schema Check]', check.message);
    return check.message;
  }

  return null;
}
