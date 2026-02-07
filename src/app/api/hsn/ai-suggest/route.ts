// POST /api/hsn/ai-suggest
// Get AI suggestions for HSN code (advisory only)

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { can, createPermissionError } from "@/lib/permissions";
import { suggestHsnAI } from "@/lib/hsn/ai-suggestions";
import { autoMapHsn } from "@/lib/hsn/auto-map";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const role = user.role as string;

    // Only Owner/Super Admin can request AI suggestions (cost control)
    const posRole = role === "owner" || role === "super_admin" ? "OWNER" : role.toUpperCase();
    if (posRole !== "OWNER") {
      return NextResponse.json(
        { error: "Only Owner/Admin can access AI suggestions" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { productName, category, saltComposition, brandName, productId } = body;

    if (!productName) {
      return NextResponse.json(
        { error: "productName is required" },
        { status: 400 }
      );
    }

    // First try deterministic rules
    const ruleSuggestion = await autoMapHsn(
      productName,
      category || null,
      saltComposition || null,
      brandName || null
    );

    // Convert confidence string to number for comparison
    const confidenceMap: Record<string, number> = {
      HIGH: 0.9,
      MEDIUM: 0.7,
      LOW: 0.5,
    };
    const ruleConfidence = ruleSuggestion
      ? confidenceMap[ruleSuggestion.confidence] || 0.5
      : 0;

    // If rules found high confidence match, return it
    if (ruleSuggestion && ruleConfidence > 0.8) {
      return NextResponse.json({
        suggestions: [
          {
            hsnCode: ruleSuggestion.hsnCode,
            description: ruleSuggestion.description,
            gstRate: ruleSuggestion.gstRate,
            gstType: "EXCLUSIVE", // Default, can be enhanced
            confidence: ruleConfidence,
            rationale: `Matched ${ruleSuggestion.matchType} pattern: ${ruleSuggestion.matchPattern}`,
            source: "RULES",
            priority: 1,
          },
        ],
        source: "RULES",
        message: "Deterministic rule match found",
      });
    }

    // If no API key or rules failed, return rules result (even if low confidence)
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        suggestions: ruleSuggestion
          ? [
              {
                hsnCode: ruleSuggestion.hsnCode,
                description: ruleSuggestion.description,
                gstRate: ruleSuggestion.gstRate,
                gstType: "EXCLUSIVE",
                confidence: ruleConfidence,
                rationale: `Matched ${ruleSuggestion.matchType} pattern: ${ruleSuggestion.matchPattern}`,
                source: "RULES",
                priority: 1,
              },
            ]
          : [],
        source: "RULES",
        message: "AI suggestions unavailable. Using deterministic rules only.",
      });
    }

    // Get AI suggestions
    const aiSuggestions = await suggestHsnAI(
      productName,
      category,
      saltComposition,
      brandName
    );

    // Combine: rules first, then AI
    const suggestions: any[] = [];
    if (ruleSuggestion) {
      suggestions.push({
        hsnCode: ruleSuggestion.hsnCode,
        description: ruleSuggestion.description,
        gstRate: ruleSuggestion.gstRate,
        gstType: "EXCLUSIVE",
        confidence: ruleConfidence,
        rationale: `Matched ${ruleSuggestion.matchType} pattern: ${ruleSuggestion.matchPattern}`,
        source: "RULES",
        priority: 1,
      });
    }

    // Add AI suggestions with lower priority
    for (const ai of aiSuggestions) {
      // Skip if duplicate HSN code already in suggestions
      const exists = suggestions.some((s) => s.hsnCode === ai.hsnCode);
      if (!exists) {
        suggestions.push({
          ...ai,
          priority: suggestions.length + 1,
        });
      }
    }

    return NextResponse.json({
      suggestions,
      source: suggestions.length > 0 && suggestions[0].source === "RULES" ? "RULES_AND_AI" : "AI",
      message: "Suggestions from deterministic rules and AI",
      disclaimer: "AI suggestions are advisory only. Verify before applying.",
    });
  } catch (error: any) {
    console.error("HSN AI suggest error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get HSN suggestions" },
      { status: 500 }
    );
  }
}
