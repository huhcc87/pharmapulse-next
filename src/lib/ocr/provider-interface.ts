// OCR provider interface for prescription parsing

export interface OCRProvider {
  parseImage(imageData: Buffer | string, mimeType: string): Promise<OCRResult>;
  parsePDF(pdfData: Buffer): Promise<OCRResult>;
}

export interface OCRResult {
  text: string;
  confidence: number;
  lines: OCRLine[];
  metadata?: {
    language?: string;
    processingTime?: number;
  };
}

export interface OCRLine {
  text: string;
  confidence: number;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ParsedPrescription {
  doctorName?: string;
  doctorLicense?: string;
  date?: string;
  patientName?: string;
  patientAge?: number;
  lines: ParsedPrescriptionLine[];
  confidence: number;
  rawText: string;
}

export interface ParsedPrescriptionLine {
  medicationName: string;
  strength?: string;
  dosageForm?: string; // tablet, capsule, syrup, etc.
  frequency?: string; // "1-1-1", "BID", "TID", etc.
  duration?: string; // "5 days", "1 week", etc.
  quantity?: number;
  instructions?: string;
  confidence: number;
}
