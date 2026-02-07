/**
 * Deep Multi-Source Web Research API
 * Performs structured extraction from multiple sources
 * Returns high-quality suggestions with confidence scoring
 * Confidence capped at 95% until pharmacist verification
 */

import { NextResponse } from "next/server";
import { DeepWebResearch } from "@/lib/ai/deepWebResearch";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { barcode, productName, hsnCode } = body;

    // Priority order: barcode > productName > hsnCode
    let searchQuery = barcode || productName || hsnCode;

    if (!searchQuery || searchQuery.trim().length < 3) {
      return NextResponse.json(
        { error: "Barcode, product name, or HSN code required (min 3 characters)" },
        { status: 400 }
      );
    }

    // Use Deep Multi-Source Research Engine
    const researchResult = await DeepWebResearch.researchProduct({
      barcode: barcode || undefined,
      productName: productName || undefined,
      hsnCode: hsnCode || undefined,
    });

    // Check if we have any meaningful suggestions
    const hasSuggestions = Object.keys(researchResult.suggestions).some(
      key => researchResult.suggestions[key as keyof typeof researchResult.suggestions] !== null && 
             researchResult.suggestions[key as keyof typeof researchResult.suggestions] !== undefined &&
             researchResult.suggestions[key as keyof typeof researchResult.suggestions] !== ''
    );

    if (hasSuggestions && researchResult.overallConfidence > 0) {
      return NextResponse.json({
        success: true,
        suggestions: {
          name: researchResult.suggestions.productName || null,
          category: researchResult.suggestions.category || null,
          manufacturer: researchResult.suggestions.manufacturer || null,
          composition: researchResult.suggestions.composition || null,
          saltComposition: researchResult.suggestions.saltComposition || null,
          mrp: researchResult.suggestions.mrp || null,
          unitPrice: researchResult.suggestions.unitPrice || null,
          hsnCode: researchResult.suggestions.hsnCode || hsnCode || '30049099',
          schedule: researchResult.suggestions.schedule || null,
          description: researchResult.suggestions.description || null,
          packSize: researchResult.suggestions.packSize || null,
        },
        confidence: Math.min(researchResult.overallConfidence, 95), // Cap at 95% until verification
        overallConfidence: Math.min(researchResult.overallConfidence, 95),
        fieldConfidence: researchResult.fieldConfidence,
        sources: researchResult.sourcesUsed,
        warnings: researchResult.warnings,
        verificationStatus: researchResult.verificationStatus,
      });
    }

    // No results found
    return NextResponse.json({
      success: false,
      error: "No reliable product data found. Please enter details manually.",
      confidence: 0,
      overallConfidence: 0,
      suggestions: null,
      fieldConfidence: [],
      sources: [],
      warnings: ["No product data found in web sources. Please enter details from package label."],
    });
  } catch (error: any) {
    console.error("Web research error:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || "Failed to research product details",
        confidence: 0,
        suggestions: null,
      },
      { status: 500 }
    );
  }
}
