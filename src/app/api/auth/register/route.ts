/**
 * Registration API Route - Production-Ready with Validation & Timeout
 * 
 * DevTools:
 * - Check Network tab for request/response
 * - Check Server logs for [Register API:requestId] debug logs (dev only)
 * - Request includes requestId for cross-reference with client logs
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";
import { cookies } from "next/headers";

// Validate environment variables at module load (dev only)
if (process.env.NODE_ENV === 'development') {
  const requiredEnvVars = ['DATABASE_URL'];
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.warn('[Register API] Missing environment variables:', missing.join(', '));
  }
}

const TIMEOUT_MS = 20000; // 20 second server-side timeout
const PASSWORD_MIN_LENGTH = 8;

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { 
      valid: false, 
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters and contain at least one number.` 
    };
  }
  if (!/\d/.test(password)) {
    return { 
      valid: false, 
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters and contain at least one number.` 
    };
  }
  return { valid: true };
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  const isDev = process.env.NODE_ENV === 'development';

  // Dev logging
  if (isDev) {
    console.debug(`[Register API:${requestId}] Request received`, {
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Parse request body with timeout protection
    let body;
    try {
      const bodyPromise = request.json();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS);
      });
      
      body = await Promise.race([bodyPromise, timeoutPromise]);
    } catch (parseError: any) {
      if (parseError.message === 'TIMEOUT') {
        if (isDev) {
          console.debug(`[Register API:${requestId}] Request body parse timeout`);
        }
        return NextResponse.json(
          { error: "Request timeout. Please try again.", code: "TIMEOUT" },
          { status: 408 }
        );
      }
      throw parseError;
    }

    const { name, email, password, requestId: clientRequestId } = body;
    const effectiveRequestId = clientRequestId || requestId;

    // Validation: Name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    if (name.trim().length < 2) {
      return NextResponse.json(
        { error: "Name must be at least 2 characters", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Validation: Email
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Valid email is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!validateEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: "Enter a valid email address", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Validation: Password
    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error || "Password does not meet requirements", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Check if user already exists
    let existingUser;
    try {
      existingUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
    } catch (dbError: any) {
      if (isDev) {
        console.debug(`[Register API:${effectiveRequestId}] Database query error`, {
          error: dbError.message,
          code: dbError.code,
        });
      }
      
      if (dbError.code === "P1001" || dbError.message?.includes("connect")) {
        return NextResponse.json(
          { error: "Database connection failed. Please try again later.", code: "DB_CONNECTION_ERROR" },
          { status: 503 }
        );
      }
      throw dbError;
    }

    if (existingUser) {
      if (isDev) {
        console.debug(`[Register API:${effectiveRequestId}] Duplicate email attempt`, {
          email: normalizedEmail,
        });
      }
      return NextResponse.json(
        { error: "Account already exists. Please sign in.", code: "DUPLICATE_EMAIL" },
        { status: 400 }
      );
    }

    // Hash password (with timeout protection)
    let passwordHash;
    try {
      const hashPromise = bcrypt.hash(password, 10);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT')), 5000); // 5s max for hashing
      });
      passwordHash = await Promise.race([hashPromise, timeoutPromise]);
    } catch (hashError: any) {
      if (hashError.message === 'TIMEOUT') {
        return NextResponse.json(
          { error: "Password processing timeout. Please try again.", code: "TIMEOUT" },
          { status: 408 }
        );
      }
      throw hashError;
    }

    // Create user and tenant (handle tenant creation failure gracefully)
    let user;
    let tenant: { id: string } | null = null;
    
    try {
      // Create user first
      user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          role: "OWNER", // First user is owner
        },
      });

      if (isDev) {
        console.debug(`[Register API:${effectiveRequestId}] User created`, {
          userId: user.id,
        });
      }
    } catch (userError: any) {
      if (isDev) {
        console.debug(`[Register API:${effectiveRequestId}] User creation error`, {
          error: userError.message,
          code: userError.code,
        });
      }

      // Handle unique constraint violations (duplicate email - race condition)
      if (userError.code === "P2002") {
        return NextResponse.json(
          { error: "Account already exists. Please sign in.", code: "DUPLICATE_EMAIL" },
          { status: 400 }
        );
      }

      throw userError;
    }

    // Try to create or find tenant (non-blocking - tenant creation failure won't block registration)
    try {
      // Check if Tenant model/table exists by trying to query it
      tenant = await prisma.tenant.findFirst({
        orderBy: { createdAt: "asc" },
      });

      if (!tenant) {
        tenant = await prisma.tenant.create({
          data: {
            name: `${name.trim()}'s Pharmacy`,
          },
        });
      }

      if (isDev) {
        console.debug(`[Register API:${effectiveRequestId}] Tenant created/found`, {
          tenantId: tenant.id,
        });
      }
    } catch (tenantError: any) {
      // Tenant creation/query failure is non-fatal - user can still be created
      // This handles cases where Tenant table doesn't exist or has schema issues
      if (isDev) {
        console.debug(`[Register API:${effectiveRequestId}] Tenant creation/query failed (non-fatal)`, {
          error: tenantError.message,
          code: tenantError.code,
          // User account created successfully, tenant will be created on first login
        });
      }
      
      // Create a placeholder tenant object for cookie setting (will use user ID as fallback)
      tenant = { id: user.id.toString() }; // Fallback: use user ID as tenant ID
    }

    // Set authentication cookies (non-blocking, non-fatal)
    try {
      const c = await cookies();
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        maxAge: 365 * 24 * 60 * 60, // 1 year
        path: "/",
      };

      // Use tenant ID or fallback to user ID if tenant creation failed
      const tenantId = tenant?.id || user.id.toString();
      
      c.set("pp_tenant", tenantId, cookieOptions);
      c.set("pp_user", user.id.toString(), cookieOptions);
      c.set("pp_email", user.email, cookieOptions);
      c.set("pp_role", user.role, cookieOptions);
    } catch (cookieError: any) {
      // Cookie setting failure is non-fatal - user can sign in after
      if (isDev) {
        console.debug(`[Register API:${effectiveRequestId}] Cookie setting failed (non-fatal)`, {
          error: cookieError.message,
        });
      }
      // Continue - cookies will be set on next login
    }

    const duration = Date.now() - startTime;

    // Success logging (dev only)
    if (isDev) {
      console.debug(`[Register API:${effectiveRequestId}] Registration successful`, {
        userId: user.id,
        email: normalizedEmail,
        tenantId: tenant?.id || 'fallback',
        duration,
      });
    }

    // Warn if tenant creation failed (but registration still succeeded)
    const response: any = {
      success: true,
      message: "Account created successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };

    // Add warning if tenant wasn't created (dev only, or show to user if needed)
    if (!tenant || tenant.id === user.id.toString()) {
      response.warning = "Account created successfully. Some profile setup may need to be completed on first login.";
    }

    return NextResponse.json(response);

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    // Enhanced error logging (dev only - never log passwords)
    if (isDev) {
      console.debug(`[Register API:${requestId}] Registration error`, {
        error: error.message,
        code: error.code,
        name: error.name,
        duration,
        // Never log password or sensitive data
      });
    } else {
      // Production: minimal logging
      console.error("Registration error:", error.message);
    }
    
    // Handle Prisma errors
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Account already exists. Please sign in.", code: "DUPLICATE_EMAIL" },
        { status: 400 }
      );
    }

    if (error.code === "P1001" || error.message?.includes("connect")) {
      return NextResponse.json(
        { error: "Database connection failed. Please try again later.", code: "DB_CONNECTION_ERROR" },
        { status: 503 }
      );
    }

    if (error.code === "P2003" || error.code === "P2014") {
      return NextResponse.json(
        { error: "Invalid data provided. Please check your information and try again.", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    if (error.code === "P2024" || error.message?.includes("timeout")) {
      return NextResponse.json(
        { error: "Request timeout. Please try again.", code: "TIMEOUT" },
        { status: 408 }
      );
    }

    // Generic error (don't expose internal details in production)
    return NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'development' 
          ? `Server error: ${error.message}` 
          : "Failed to create account. Please try again.",
        code: "SERVER_ERROR"
      },
      { status: 500 }
    );
  }
}