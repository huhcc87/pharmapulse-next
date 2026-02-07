// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;

// Dev-only: Run schema validation on startup
if (process.env.NODE_ENV === "development" && typeof window === "undefined") {
  import("@/lib/db/schema-check")
    .then(({ validateInventoryItemsSchema }) => validateInventoryItemsSchema())
    .catch((err) => {
      // Silently fail - don't block startup
      console.debug("Schema check skipped:", err.message);
    });
}
