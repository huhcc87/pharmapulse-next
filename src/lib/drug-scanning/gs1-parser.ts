/**
 * GS1 DataMatrix & Application Identifier Parser
 * 
 * Supports Indian pharma market standards:
 * - GTIN (AI 01)
 * - EXP (AI 17) - Expiry date
 * - BATCH/LOT (AI 10) - Batch number
 * - SERIAL (AI 21) - Serial number
 * - And other common GS1 AIs
 */

export interface GS1ParsedData {
  gtin: string | null; // GTIN-14 normalized
  expiryDate: string | null; // YYMMDD format
  batchLot: string | null;
  serialNumber: string | null;
  allAIs: Record<string, string>; // All Application Identifiers found
  rawCode: string;
  format: 'GS1_DATAMATRIX' | 'GS1_QR' | 'UPC' | 'EAN' | 'UNKNOWN';
}

/**
 * GS1 Application Identifier definitions
 */
const GS1_AI_DEFINITIONS: Record<string, { length: number; name: string }> = {
  '01': { length: 14, name: 'GTIN' },
  '10': { length: 20, name: 'BATCH/LOT' }, // Variable length, max 20
  '17': { length: 6, name: 'EXP' }, // YYMMDD
  '21': { length: 20, name: 'SERIAL' }, // Variable length, max 20
  '11': { length: 6, name: 'PROD_DATE' }, // YYMMDD
  '30': { length: 8, name: 'VAR_COUNT' },
  '310': { length: 6, name: 'NET_WEIGHT' },
  '320': { length: 6, name: 'NET_VOLUME' },
};

/**
 * Parse GS1 DataMatrix or GS1 QR code
 */
export function parseGS1Code(rawCode: string): GS1ParsedData {
  const result: GS1ParsedData = {
    gtin: null,
    expiryDate: null,
    batchLot: null,
    serialNumber: null,
    allAIs: {},
    rawCode,
    format: 'UNKNOWN',
  };

  // Detect format
  if (rawCode.startsWith(']d2') || rawCode.startsWith(']D2')) {
    result.format = 'GS1_DATAMATRIX';
    // Remove GS1 DataMatrix header
    rawCode = rawCode.substring(3);
  } else if (rawCode.includes('01') && (rawCode.length > 20)) {
    // Likely GS1 QR (contains AI 01 and is long)
    result.format = 'GS1_QR';
  } else {
    // Try to detect UPC/EAN
    if (/^\d{8}$/.test(rawCode)) {
      result.format = 'UPC';
    } else if (/^\d{13}$/.test(rawCode)) {
      result.format = 'EAN';
    }
  }

  // Parse Application Identifiers
  let position = 0;
  while (position < rawCode.length) {
    // Try to find AI (2 or 3 digits)
    const ai2 = rawCode.substring(position, position + 2);
    const ai3 = rawCode.substring(position, position + 3);

    let ai: string | null = null;
    let aiDef: { length: number; name: string } | null = null;

    // Check 3-digit AI first (e.g., 310, 320)
    if (GS1_AI_DEFINITIONS[ai3]) {
      ai = ai3;
      aiDef = GS1_AI_DEFINITIONS[ai3];
      position += 3;
    } else if (GS1_AI_DEFINITIONS[ai2]) {
      ai = ai2;
      aiDef = GS1_AI_DEFINITIONS[ai2];
      position += 2;
    } else {
      // No valid AI found, skip
      position++;
      continue;
    }

    if (!aiDef) continue;

    // Extract value
    let valueLength = aiDef.length;
    
    // Variable length AIs (10, 21) use FNC1 (ASCII 29) or group separator as terminator
    if (ai === '10' || ai === '21') {
      const remaining = rawCode.substring(position);
      const fnc1Index = remaining.indexOf(String.fromCharCode(29));
      const gsIndex = remaining.indexOf('\x1D'); // Group separator
      const terminatorIndex = fnc1Index !== -1 && gsIndex !== -1 
        ? Math.min(fnc1Index, gsIndex)
        : fnc1Index !== -1 ? fnc1Index : gsIndex;
      
      if (terminatorIndex !== -1) {
        valueLength = terminatorIndex;
      } else {
        // Use remaining length (up to max)
        valueLength = Math.min(remaining.length, aiDef.length);
      }
    }

    const value = rawCode.substring(position, position + valueLength);
    position += valueLength;

    // Store AI value
    result.allAIs[ai] = value;

    // Extract specific fields
    if (ai === '01') {
      // GTIN - normalize to GTIN-14
      result.gtin = normalizeGTIN(value);
    } else if (ai === '17') {
      // EXP - Expiry date (YYMMDD)
      result.expiryDate = value;
    } else if (ai === '10') {
      // BATCH/LOT
      result.batchLot = value;
    } else if (ai === '21') {
      // SERIAL
      result.serialNumber = value;
    }

    // Skip FNC1 or group separator if present
    if (position < rawCode.length) {
      const nextChar = rawCode[position];
      if (nextChar === String.fromCharCode(29) || nextChar === '\x1D') {
        position++;
      }
    }
  }

  return result;
}

/**
 * Normalize GTIN to GTIN-14 format
 * Handles GTIN-8, GTIN-12, GTIN-13, GTIN-14
 */
export function normalizeGTIN(gtin: string): string {
  // Remove any non-digit characters
  const digits = gtin.replace(/\D/g, '');

  if (digits.length === 14) {
    return digits; // Already GTIN-14
  } else if (digits.length === 13) {
    // GTIN-13: Add leading zero
    return '0' + digits;
  } else if (digits.length === 12) {
    // GTIN-12 (UPC-A): Add two leading zeros
    return '00' + digits;
  } else if (digits.length === 8) {
    // GTIN-8 (EAN-8): Add six leading zeros
    return '000000' + digits;
  }

  // Invalid length, return as-is
  return digits;
}

/**
 * Parse expiry date from GS1 format (YYMMDD) to Date
 */
export function parseExpiryDate(expiryYYMMDD: string): Date | null {
  if (!expiryYYMMDD || expiryYYMMDD.length !== 6) {
    return null;
  }

  const year = parseInt('20' + expiryYYMMDD.substring(0, 2), 10);
  const month = parseInt(expiryYYMMDD.substring(2, 4), 10) - 1; // Month is 0-indexed
  const day = parseInt(expiryYYMMDD.substring(4, 6), 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return null;
  }

  // Validate month and day
  if (month < 0 || month > 11 || day < 1 || day > 31) {
    return null;
  }

  try {
    const date = new Date(year, month, day);
    // Verify date is valid
    if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
      return date;
    }
  } catch (error) {
    // Invalid date
  }

  return null;
}

/**
 * Detect code format from raw code
 */
export function detectCodeFormat(rawCode: string): 'UPC' | 'EAN' | 'GS1_DATAMATRIX' | 'GS1_QR' | 'QR' | 'INMED' | 'UNKNOWN' {
  // GS1 DataMatrix
  if (rawCode.startsWith(']d2') || rawCode.startsWith(']D2')) {
    return 'GS1_DATAMATRIX';
  }

  // INMED format
  if (/^INMED-\d{6}$/i.test(rawCode)) {
    return 'INMED';
  }

  // UPC (8 digits)
  if (/^\d{8}$/.test(rawCode)) {
    return 'UPC';
  }

  // EAN-13 (13 digits)
  if (/^\d{13}$/.test(rawCode)) {
    return 'EAN';
  }

  // GS1 QR (contains AI 01 and is long)
  if (rawCode.includes('01') && rawCode.length > 20 && /^\d+$/.test(rawCode)) {
    return 'GS1_QR';
  }

  // Generic QR (URL or text)
  if (rawCode.startsWith('http') || rawCode.length > 20) {
    return 'QR';
  }

  return 'UNKNOWN';
}

/**
 * Extract GTIN from various formats
 */
export function extractGTIN(rawCode: string, format?: string): string | null {
  const detectedFormat = format || detectCodeFormat(rawCode);

  if (detectedFormat === 'GS1_DATAMATRIX' || detectedFormat === 'GS1_QR') {
    const parsed = parseGS1Code(rawCode);
    return parsed.gtin;
  } else if (detectedFormat === 'UPC' || detectedFormat === 'EAN') {
    return normalizeGTIN(rawCode);
  }

  return null;
}
