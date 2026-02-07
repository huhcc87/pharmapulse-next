// Offline entitlement token utilities
// Using simple JWT-like structure (can be replaced with actual jwt library)
// For now, use crypto for HMAC signing

import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'change-me-in-production';

export interface OfflineTokenPayload {
  tenantId: number;
  deviceId: string;
  tokenId: string;
  issuedAt: number;
  expiresAt: number;
  maxOfflineInvoices: number;
  permissions: any;
}

/**
 * Generate offline entitlement token (HMAC-signed JSON)
 */
export function generateOfflineToken(payload: Omit<OfflineTokenPayload, 'issuedAt'>): string {
  const tokenPayload: OfflineTokenPayload = {
    ...payload,
    issuedAt: Math.floor(Date.now() / 1000),
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify offline entitlement token
 */
export function verifyOfflineToken(token: string): OfflineTokenPayload | null {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split('.');
    
    if (!encodedHeader || !encodedPayload || !signature) {
      return null;
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return null;
    }

    // Decode payload
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    ) as OfflineTokenPayload;

    // Check expiry
    if (isTokenExpired(payload)) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(tokenPayload: OfflineTokenPayload): boolean {
  return Date.now() / 1000 > tokenPayload.expiresAt;
}
