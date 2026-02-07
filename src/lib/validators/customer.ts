// src/lib/validators/customer.ts
// Customer validation utilities

export interface CreateCustomerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
}

export interface CreateCustomerResult {
  ok: true;
  customer: {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    createdAt: Date;
  };
}

export interface CreateCustomerError {
  ok: false;
  error: string;
  statusCode: number;
}

/**
 * Normalize customer input: trim strings, convert empty strings to null
 */
export function normalizeCustomerInput(input: CreateCustomerInput): {
  name: string;
  phone: string | null;
  email: string | null;
} {
  const name = (input.name || "").trim();
  const phone = input.phone ? input.phone.trim() : null;
  // Normalize email: trim, lowercase, convert empty string to null
  const email = input.email 
    ? input.email.trim().toLowerCase() 
    : null;

  return {
    name,
    phone: phone === "" ? null : phone,
    email: email === "" ? null : email,
  };
}

/**
 * Validate customer input
 */
export function validateCustomerInput(
  normalized: ReturnType<typeof normalizeCustomerInput>
): { valid: true } | { valid: false; error: string } {
  // Name validation
  if (!normalized.name || normalized.name.length < 2) {
    return { valid: false, error: "Name must be at least 2 characters" };
  }

  // Phone validation (optional, but if provided, should be valid)
  if (normalized.phone) {
    // Remove spaces, dashes, parentheses for validation
    const phoneDigits = normalized.phone.replace(/[\s\-\(\)]/g, "");
    // India: 10 digits, optionally with +91 prefix
    if (!/^(\+91)?[6-9]\d{9}$/.test(phoneDigits)) {
      return {
        valid: false,
        error: "Phone number must be a valid 10-digit Indian number",
      };
    }
  }

  // Email validation (optional, but if provided, should be valid)
  if (normalized.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized.email)) {
      return { valid: false, error: "Email must be a valid email address" };
    }
  }

  return { valid: true };
}

