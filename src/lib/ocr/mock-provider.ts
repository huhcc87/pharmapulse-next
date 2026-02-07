// Mock OCR provider for development/testing
// In production, replace with Tesseract.js or cloud OCR service

import { OCRProvider, OCRResult, ParsedPrescription, ParsedPrescriptionLine } from "./provider-interface";

export class MockOCRProvider implements OCRProvider {
  async parseImage(imageData: Buffer | string, mimeType: string): Promise<OCRResult> {
    // Simulate OCR processing delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock parsed text (in production, this would use actual OCR)
    const mockText = `Dr. Ramesh Kumar
License: REG/1234/2015
Date: ${new Date().toLocaleDateString("en-IN")}

Patient: Rajesh Patel, Age: 45

Rx:
1. Dolo 650mg Tablet - 1-0-1 after food - 5 days
2. Amoxicillin 500mg Capsule - 1-0-1 - 7 days
3. Pantoprazole 40mg Tablet - 1-0-0 before breakfast - 10 days`;

    return {
      text: mockText,
      confidence: 0.75, // Mock confidence
      lines: mockText.split("\n").map((line, idx) => ({
        text: line,
        confidence: 0.75 - idx * 0.05, // Decreasing confidence
      })),
      metadata: {
        language: "en",
        processingTime: 1000,
      },
    };
  }

  async parsePDF(pdfData: Buffer): Promise<OCRResult> {
    // Similar to parseImage, but for PDF
    return this.parseImage(pdfData, "application/pdf");
  }
}

/**
 * Parse OCR text into structured prescription data
 */
export function parsePrescriptionText(ocrResult: OCRResult): ParsedPrescription {
  const lines = ocrResult.text.split("\n").filter((l) => l.trim());
  
  let doctorName: string | undefined;
  let doctorLicense: string | undefined;
  let date: string | undefined;
  let patientName: string | undefined;
  let patientAge: number | undefined;
  const prescriptionLines: ParsedPrescriptionLine[] = [];

  let inRxSection = false;

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Extract doctor name
    if (lower.startsWith("dr.") || lower.match(/^doctor\s/i)) {
      doctorName = line.replace(/^dr\.?\s*/i, "").trim();
      continue;
    }

    // Extract license
    if (lower.includes("license:")) {
      doctorLicense = line.split(/license:?\s*/i)[1]?.trim();
      continue;
    }

    // Extract date
    if (lower.includes("date:")) {
      date = line.split(/date:?\s*/i)[1]?.trim();
      continue;
    }

    // Extract patient info
    if (lower.includes("patient:") || lower.includes("name:")) {
      const match = line.match(/(?:patient|name):\s*(.+?)(?:\s*,\s*age:?\s*(\d+))?/i);
      if (match) {
        patientName = match[1].trim();
        patientAge = match[2] ? parseInt(match[2], 10) : undefined;
      }
      continue;
    }

    // Start of Rx section
    if (lower.includes("rx:") || lower.includes("prescription:")) {
      inRxSection = true;
      continue;
    }

    // Parse prescription lines
    if (inRxSection || /^\d+\./.test(line)) {
      const parsed = parsePrescriptionLine(line);
      if (parsed) {
        prescriptionLines.push(parsed);
      }
    }
  }

  return {
    doctorName,
    doctorLicense,
    date,
    patientName,
    patientAge,
    lines: prescriptionLines,
    confidence: ocrResult.confidence,
    rawText: ocrResult.text,
  };
}

/**
 * Parse a single prescription line
 * Example: "1. Dolo 650mg Tablet - 1-0-1 after food - 5 days"
 */
function parsePrescriptionLine(line: string): ParsedPrescriptionLine | null {
  // Remove line number
  const cleanLine = line.replace(/^\d+\.\s*/, "").trim();
  if (!cleanLine) return null;

  // Split by dashes or commas
  const parts = cleanLine.split(/\s*[-–—,]\s*/);

  if (parts.length === 0) return null;

  // First part: medication name and strength
  const medPart = parts[0].trim();
  const medMatch = medPart.match(/^(.+?)(?:\s+(\d+(?:\.\d+)?)\s*(mg|g|ml|%))?(?:\s+(tablet|capsule|syrup|injection|drops|cream|ointment))?$/i);
  
  const medicationName = medMatch ? medMatch[1].trim() : medPart;
  const strength = medMatch && medMatch[2] ? `${medMatch[2]}${medMatch[3] || ""}` : undefined;
  const dosageForm = medMatch && medMatch[4] ? medMatch[4].toLowerCase() : undefined;

  // Second part: frequency
  let frequency: string | undefined;
  if (parts.length > 1) {
    frequency = parts[1].trim();
  }

  // Third part: duration
  let duration: string | undefined;
  if (parts.length > 2) {
    duration = parts[2].trim();
  }

  // Extract quantity from duration or frequency
  let quantity: number | undefined;
  const durationMatch = duration?.match(/(\d+)\s*(?:days?|weeks?|months?)/i);
  if (durationMatch) {
    const days = parseInt(durationMatch[1], 10);
    // Estimate quantity based on frequency
    if (frequency) {
      const freqMatch = frequency.match(/(\d+)[-\s]*(\d+)[-\s]*(\d+)/);
      if (freqMatch) {
        const dailyDoses = parseInt(freqMatch[1], 10) + parseInt(freqMatch[2], 10) + parseInt(freqMatch[3], 10);
        quantity = dailyDoses * days;
      }
    }
  }

  return {
    medicationName,
    strength,
    dosageForm,
    frequency,
    duration,
    quantity,
    instructions: parts.slice(3).join(". ").trim() || undefined,
    confidence: 0.7, // Mock confidence
  };
}
