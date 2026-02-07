/**
 * Licence Utility Functions
 * 
 * Handles generation of licence keys, renewal codes, and device fingerprinting
 * using cryptographically secure methods.
 */

import crypto from 'crypto';

const LICENCE_KEY_SECRET = process.env.LICENCE_KEY_SECRET || 'default-secret-change-in-production';
const RENEWAL_CODE_SECRET = process.env.RENEWAL_CODE_SECRET || 'default-renewal-secret-change-in-production';

/**
 * Generate a cryptographically secure licence key
 * Format: LIC-{random bytes in hex, 32 chars}-{timestamp in hex, 8 chars}
 */
export function generateLicenceKey(): string {
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(16).padStart(8, '0');
  return `LIC-${randomBytes}-${timestamp}`;
}

/**
 * Generate a renewal code using HMAC
 * Format: RENEW-{HMAC(licence_id + timestamp, secret)}-{timestamp}
 */
export function generateRenewalCode(licenceId: string): string {
  const timestamp = Date.now();
  const message = `${licenceId}:${timestamp}`;
  const hmac = crypto
    .createHmac('sha256', RENEWAL_CODE_SECRET)
    .update(message)
    .digest('hex')
    .substring(0, 32); // First 32 chars
  return `RENEW-${hmac}-${timestamp.toString(16)}`;
}

/**
 * Verify a renewal code
 */
export function verifyRenewalCode(renewalCode: string, licenceId: string): boolean {
  try {
    const parts = renewalCode.split('-');
    if (parts.length !== 3 || parts[0] !== 'RENEW') {
      return false;
    }
    const timestamp = parseInt(parts[2], 16);
    const message = `${licenceId}:${timestamp}`;
    const expectedHmac = crypto
      .createHmac('sha256', RENEWAL_CODE_SECRET)
      .update(message)
      .digest('hex')
      .substring(0, 32);
    return expectedHmac === parts[1];
  } catch {
    return false;
  }
}

/**
 * Generate device fingerprint from User-Agent and hardware information
 * Returns a SHA-256 hash for security
 */
export function generateDeviceFingerprint(
  userAgent: string, 
  additionalInfo?: Record<string, string>
): string {
  const components = [
    userAgent || '',
    additionalInfo?.platform || '',
    additionalInfo?.hardwareConcurrency || '',
    additionalInfo?.deviceMemory || '',
    additionalInfo?.screenResolution || '',
    additionalInfo?.timezone || '',
    additionalInfo?.language || '',
  ].filter(Boolean);

  const fingerprintString = components.join('|');
  return crypto.createHash('sha256').update(fingerprintString).digest('hex');
}

/**
 * Generate device fingerprint from request headers
 * Compatible with existing device-id.ts approach
 */
export function generateDeviceFingerprintFromHeaders(
  userAgent: string | null,
  headers: Headers
): string {
  const components = [
    userAgent || '',
    headers.get('sec-ch-ua-platform') || '',
    headers.get('accept-language')?.split(',')[0] || '',
  ].filter(Boolean);

  const fingerprintString = components.join('|');
  return crypto.createHash('sha256').update(fingerprintString).digest('hex');
}

/**
 * Mask licence key - show only last 4 characters
 */
export function maskLicenceKey(licenceKey: string | null | undefined): string {
  if (!licenceKey) {
    return 'Not set';
  }
  if (licenceKey.length <= 4) {
    return '••••';
  }
  return '••••' + licenceKey.slice(-4);
}

/**
 * Check if renewal code has expired (30 days)
 */
export function isRenewalCodeExpired(createdAt: Date): boolean {
  const expiryDate = new Date(createdAt);
  expiryDate.setDate(expiryDate.getDate() + 30); // 30 days expiry
  return new Date() > expiryDate;
}

/**
 * Calculate days remaining until expiry
 */
export function getDaysRemaining(expiresAt: Date | null | undefined): number | null {
  if (!expiresAt) {
    return null;
  }
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}
