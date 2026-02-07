import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    // Check authentication - Skip for now (can be added later with proper session handling)
    // const session = await getServerSession(authOptions);
    // if (!session || !session.user) {
    //   return NextResponse.json(
    //     { error: "Authentication required" },
    //     { status: 401 }
    //   );
    // }

    // Parse request body
    const body = await req.json();
    const { feature, input } = body;

    if (!feature || !input) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Log AI request
    const aiAuditLog = await (prisma as any).aiAuditLog.create({
      data: {
        userId: 1, // TODO: Get from session when auth is implemented
        feature,
        inputText: input,
      },
    });

    // Process based on feature
    let result;
    switch (feature) {
      case "PARSE_PRODUCT_TEXT":
        result = await parseProductText(input);
        break;
      case "COMPOSITION_LOOKUP":
        result = await lookupComposition(input);
        break;
      case "ALTERNATIVE_SUGGEST":
        result = await suggestAlternatives(input);
        break;
      default:
        return NextResponse.json(
          { error: "Invalid feature specified" },
          { status: 400 }
        );
    }

    // Update AI audit log with result
    await (prisma as any).aiAuditLog.update({
      where: { id: aiAuditLog.id },
      data: {
        aiOutputJson: result,
      },
    });

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error("AI API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// AI feature implementations
async function parseProductText(input: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a pharmaceutical expert AI assistant. Parse the following product text and extract structured information in JSON format with the following fields:
        - genericName: The generic/scientific name of the drug
        - brandName: The commercial/brand name
        - dosageForm: The form (tablet, capsule, syrup, etc.)
        - strength: The strength/dosage
        - manufacturer: The company that makes it
        - compositionText: Full composition details
        - packSize: Number of units in pack
        - schedule: Drug schedule classification (OTC, H, H1, X)`,
      },
      {
        role: "user",
        content: input,
      },
    ],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || "{}");
}

async function lookupComposition(input: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a pharmaceutical expert AI assistant. Analyze the following drug composition and provide detailed information in JSON format with the following fields:
        - ingredients: Array of active ingredients
        - therapeuticCategory: Primary therapeutic category
        - indications: Common medical uses
        - contraindications: When the drug should not be used
        - sideEffects: Common side effects
        - interactions: Known drug interactions
        - safetyNotes: Important safety information`,
      },
      {
        role: "user",
        content: input,
      },
    ],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || "{}");
}

async function suggestAlternatives(input: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a pharmaceutical expert AI assistant for the Indian market. Suggest alternative medications for the given drug in JSON format with the following fields:
        - genericAlternatives: Array of generic alternatives with same active ingredients
        - therapeuticAlternatives: Array of drugs with different active ingredients but similar therapeutic effects
        - affordableOptions: Array of more affordable alternatives (especially PMBJP options if available)
        - notes: Important notes about substitution`,
      },
      {
        role: "user",
        content: input,
      },
    ],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || "{}");
}
