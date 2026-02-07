/**
 * Rate Limiting for Licence Validation Failures
 * 
 * Prevents brute force attacks on licence validation
 */

// In-memory store for rate limiting (use Redis in production)
const validationFailureStore = new Map<string, { count: number; resetAt: number }>();

const MAX_FAILURES = 5; // Max failures before blocking
const WINDOW_MINUTES = 15; // Time window in minutes
const BLOCK_DURATION_MINUTES = 60; // Block duration in minutes

/**
 * Check if IP/device is rate limited
 */
export function isRateLimited(identifier: string): boolean {
  const record = validationFailureStore.get(identifier);
  
  if (!record) {
    return false;
  }

  const now = Date.now();
  
  // Check if block period has expired
  if (now > record.resetAt) {
    validationFailureStore.delete(identifier);
    return false;
  }

  // Check if exceeded max failures
  if (record.count >= MAX_FAILURES) {
    return true;
  }

  return false;
}

/**
 * Record a validation failure
 */
export function recordValidationFailure(identifier: string): void {
  const record = validationFailureStore.get(identifier);
  const now = Date.now();
  const resetAt = now + (BLOCK_DURATION_MINUTES * 60 * 1000);

  if (record) {
    // Increment count
    record.count += 1;
    record.resetAt = resetAt;
  } else {
    // Create new record
    validationFailureStore.set(identifier, {
      count: 1,
      resetAt: resetAt,
    });
  }
}

/**
 * Clear rate limit for identifier (after successful validation)
 */
export function clearRateLimit(identifier: string): void {
  validationFailureStore.delete(identifier);
}

/**
 * Get rate limit status
 */
export function getRateLimitStatus(identifier: string): {
  blocked: boolean;
  failures: number;
  resetAt: Date | null;
} {
  const record = validationFailureStore.get(identifier);
  
  if (!record) {
    return { blocked: false, failures: 0, resetAt: null };
  }

  const now = Date.now();
  
  if (now > record.resetAt) {
    validationFailureStore.delete(identifier);
    return { blocked: false, failures: 0, resetAt: null };
  }

  return {
    blocked: record.count >= MAX_FAILURES,
    failures: record.count,
    resetAt: new Date(record.resetAt),
  };
}

/**
 * Clean up expired entries (run periodically)
 */
export function cleanupRateLimitStore(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, record] of validationFailureStore.entries()) {
    if (now > record.resetAt) {
      validationFailureStore.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

// Clean up every hour
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupRateLimitStore();
  }, 60 * 60 * 1000); // 1 hour
}
