// Set User Language Preference
// POST /api/i18n/set-language

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { SupportedLanguage } from "@/lib/i18n/i18n";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { language } = body;

    const supportedLanguages: SupportedLanguage[] = ["en", "hi", "ta", "te", "mr", "bn", "gu", "kn"];

    if (!language || !supportedLanguages.includes(language as SupportedLanguage)) {
      return NextResponse.json(
        { error: `Language must be one of: ${supportedLanguages.join(", ")}` },
        { status: 400 }
      );
    }

    // Store language preference in user session/cookie
    // For now, return success (can be stored in database User model later)
    const response = NextResponse.json({
      success: true,
      language,
      message: "Language preference updated",
    });

    // Set cookie
    response.cookies.set("language", language, {
      maxAge: 365 * 24 * 60 * 60, // 1 year
      httpOnly: false, // Allow client-side access
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    console.error("Set language API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
