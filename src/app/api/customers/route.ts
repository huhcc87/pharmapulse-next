// src/app/api/customers/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

// GET /api/customers - Search customers
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const phone = searchParams.get("phone");

    if (phone) {
      // Exact phone match
      const customer = await prisma.customer.findUnique({
        where: { phone },
        include: {
          loyaltyAccount: true,
        },
      });

      if (!customer) {
        return NextResponse.json({ customer: null });
      }

      return NextResponse.json({
        customer: {
          ...customer,
          loyaltyPoints: customer.loyaltyAccount?.pointsBalance || 0,
          allergies: customer.allergies ? JSON.parse(customer.allergies) : [],
        },
      });
    }

    if (q.length >= 2) {
      // Search by name or phone
      const customers = await prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
          tenantId: DEMO_TENANT_ID,
        },
        include: {
          loyaltyAccount: true,
        },
        take: 20,
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        customers: customers.map((c) => ({
          ...c,
          loyaltyPoints: c.loyaltyAccount?.pointsBalance || 0,
          allergies: c.allergies ? JSON.parse(c.allergies) : [],
        })),
      });
    }

    return NextResponse.json({ customers: [] });
  } catch (error: any) {
    console.error("Customer search error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to search customers" },
      { status: 500 }
    );
  }
}

// POST /api/customers - Create customer
export async function POST(req: Request) {
  try {
    // Debug: Print DATABASE_URL (masked for security)
    const dbUrl = process.env.DATABASE_URL || "NOT SET";
    const maskedUrl = dbUrl.includes("@") 
      ? dbUrl.replace(/(:\/\/[^:]+:)[^@]+(@)/, "$1***$2")
      : dbUrl;
    console.log("🔍 [Customer API] DATABASE_URL:", maskedUrl);
    console.log("🔍 [Customer API] Database provider:", process.env.DATABASE_URL?.includes("postgres") ? "PostgreSQL" : process.env.DATABASE_URL?.includes("sqlite") ? "SQLite" : "Unknown");

    const body = await req.json();
    const { name, phone, email, dob, allergies, notes, gstin, stateCode } = body;

    // Import validators
    const {
      normalizeCustomerInput,
      validateCustomerInput,
    } = await import("@/lib/validators/customer");

    // Normalize inputs: trim and convert empty strings to null
    const normalized = normalizeCustomerInput({ name, phone, email });

    // Validate
    const validation = validateCustomerInput(normalized);
    if (!validation.valid) {
      return NextResponse.json(
        { ok: false, error: validation.error },
        { status: 400 }
      );
    }

    // Check for duplicate phone (only if phone is provided)
    if (normalized.phone) {
      try {
        const existing = await prisma.customer.findUnique({
          where: { phone: normalized.phone },
        });

        if (existing) {
          return NextResponse.json(
            {
              ok: false,
              error: "A customer with this phone number already exists",
            },
            { status: 409 }
          );
        }
      } catch (findError: any) {
        // If unique constraint doesn't exist or other error, continue
        console.warn("Phone uniqueness check failed:", findError);
      }
    }

    // Check for duplicate email (only if email is provided)
    if (normalized.email) {
      try {
        const existing = await prisma.customer.findFirst({
          where: { email: normalized.email },
        });

        if (existing) {
          return NextResponse.json(
            {
              ok: false,
              error: "A customer with this email already exists",
            },
            { status: 409 }
          );
        }
      } catch (findError: any) {
        console.warn("Email uniqueness check failed:", findError);
      }
    }

    // Create customer data object using Prisma types
    // Only include fields that exist in schema: name, phone, email, dob, allergies, notes, gstin, stateCode, tenantId
    const customerData: {
      name: string;
      phone: string | null;
      email: string | null;
      dob?: Date | null;
      allergies?: string | null;
      notes?: string | null;
      gstin?: string | null;
      stateCode?: string | null;
      tenantId?: number;
    } = {
      name: normalized.name,
      phone: normalized.phone || null,
      email: normalized.email || null,
    };

    // Add optional fields only if provided
    if (dob) customerData.dob = new Date(dob);
    if (allergies) customerData.allergies = JSON.stringify(allergies);
    if (notes) customerData.notes = notes;
    if (gstin) customerData.gstin = gstin;
    if (stateCode) customerData.stateCode = stateCode;

    // Debug: Log what we're trying to create
    console.log("🔍 [Customer API] Creating customer with data:", {
      name: customerData.name,
      phone: customerData.phone,
      email: customerData.email,
      hasTenantId: true,
    });

    let customer;
    try {
      // Try with tenantId first (schema has default, so it's optional)
      try {
        customer = await prisma.customer.create({
          data: {
            ...customerData,
            tenantId: DEMO_TENANT_ID,
          },
        });
        console.log("✅ [Customer API] Customer created successfully with tenantId");
      } catch (tenantIdError: any) {
        console.error("❌ [Customer API] Error with tenantId:", tenantIdError.message);
        // If tenantId is unknown, try without it (will use default from schema)
        if (
          tenantIdError.message?.includes("Unknown argument") &&
          tenantIdError.message?.includes("tenantId")
        ) {
          console.warn("⚠️ [Customer API] tenantId field not available, using default");
          customer = await prisma.customer.create({
            data: customerData,
          });
          console.log("✅ [Customer API] Customer created successfully without tenantId");
        } else {
          throw tenantIdError;
        }
      }
    } catch (createError: any) {
      // Handle Prisma unique constraint errors gracefully
      if (createError.code === "P2002") {
        const field = createError.meta?.target?.[0] || "field";
        return NextResponse.json(
          {
            ok: false,
            error: `A customer with this ${field} already exists`,
          },
          { status: 409 }
        );
      }

      // Handle unknown field/column errors (schema mismatch)
      const isSchemaError = 
        createError.message?.includes("Unknown argument") ||
        createError.message?.includes("column") ||
        createError.message?.includes("field") ||
        createError.message?.includes("does not exist");
      
      if (isSchemaError) {
        const fieldMatch = createError.message.match(/Unknown argument ['`]([^'`]+)['`]/) ||
                          createError.message.match(/column ['"]([^'"]+)['"]/i) ||
                          createError.message.match(/field ['"]([^'"]+)['"]/i);
        const field = fieldMatch ? fieldMatch[1] : "field";
        
        console.error(`❌ [Customer API] Database schema mismatch detected!`);
        console.error(`❌ [Customer API] Missing field/column: ${field}`);
        console.error(`❌ [Customer API] Full error:`, createError.message);
        
        // Check if we can inspect the actual database schema
        try {
          const tableInfo = await prisma.$queryRaw`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'customers' 
            ORDER BY ordinal_position;
          `;
          console.log("🔍 [Customer API] Actual database columns:", tableInfo);
        } catch (schemaError) {
          console.warn("⚠️ [Customer API] Could not query schema info:", schemaError);
        }
        
        // Return clear instructions for fixing with proper error code
        return NextResponse.json(
          {
            ok: false,
            code: "DB_SCHEMA_OUT_OF_SYNC",
            error: `Database schema error: field '${field}' not found.`,
            message: "Database is out of sync with Prisma schema.",
            hint: "Run: npm run db:sync && restart dev server",
            detailedFix: [
              "1. Run: npm run db:sync",
              "2. Restart your dev server (stop with Ctrl+C, then: npm run dev)",
              "3. Try creating the customer again"
            ],
          },
          { status: 409 }
        );
      }

      throw createError;
    }

    // Create loyalty account
    try {
      await prisma.loyaltyAccount.create({
        data: {
          customerId: customer.id,
          pointsBalance: 0,
          pointsRate: 1.0, // 1 point per ₹1
          minRedemption: 100, // Minimum 100 points to redeem
        },
      });
    } catch (loyaltyError: any) {
      // Log but don't fail - customer is created
      console.warn("Loyalty account creation failed:", loyaltyError);
    }

    // Return success response
    return NextResponse.json({
      ok: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        createdAt: customer.createdAt,
        loyaltyPoints: 0,
        allergies: allergies || [],
      },
    });
  } catch (error: any) {
    console.error("Customer creation error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message || "Failed to create customer",
      },
      { status: 500 }
    );
  }
}

