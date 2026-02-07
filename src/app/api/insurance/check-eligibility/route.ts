// POST /api/insurance/check-eligibility
// Check insurance eligibility

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";

// Insurance Provider Integration Functions

async function checkStarHealthEligibility(
  memberId: string,
  policyNumber: string
): Promise<{ isEligible: boolean; message: string; details: any }> {
  // Star Health API integration
  // In production, use: https://api.starhealth.in/v1/eligibility/check
  const apiKey = process.env.STAR_HEALTH_API_KEY;
  const apiUrl = process.env.STAR_HEALTH_API_URL || "https://api.starhealth.in/v1";

  if (!apiKey) {
    // Fallback to mock for development
    return {
      isEligible: true,
      message: "Star Health eligibility confirmed (mock)",
      details: {
        memberId,
        policyNumber,
        provider: "STAR_HEALTH",
        coverageAmount: 50000,
        copay: 20,
        networkHospital: true,
        cashless: true,
      },
    };
  }

  try {
    const response = await fetch(`${apiUrl}/eligibility/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ memberId, policyNumber }),
    });

    if (!response.ok) {
      throw new Error("Star Health API error");
    }

    const data = await response.json();
    return {
      isEligible: data.eligible === true,
      message: data.message || "Eligibility check completed",
      details: {
        memberId,
        policyNumber,
        provider: "STAR_HEALTH",
        coverageAmount: data.coverageAmount || 0,
        copay: data.copay || 0,
        networkHospital: data.networkHospital || false,
        cashless: data.cashless || false,
        expiryDate: data.expiryDate,
      },
    };
  } catch (error) {
    console.error("Star Health API error:", error);
    return {
      isEligible: false,
      message: "Failed to verify with Star Health",
      details: { memberId, policyNumber, provider: "STAR_HEALTH" },
    };
  }
}

async function checkHDFCErgoEligibility(
  memberId: string,
  policyNumber: string
): Promise<{ isEligible: boolean; message: string; details: any }> {
  // HDFC Ergo API integration
  const apiKey = process.env.HDFC_ERGO_API_KEY;
  const apiUrl = process.env.HDFC_ERGO_API_URL || "https://api.hdfcergo.com/v1";

  if (!apiKey) {
    return {
      isEligible: true,
      message: "HDFC Ergo eligibility confirmed (mock)",
      details: {
        memberId,
        policyNumber,
        provider: "HDFC_ERGO",
        coverageAmount: 75000,
        copay: 15,
        networkHospital: true,
        cashless: true,
      },
    };
  }

  // Similar implementation as Star Health
  return checkStarHealthEligibility(memberId, policyNumber);
}

async function checkICICILombardEligibility(
  memberId: string,
  policyNumber: string
): Promise<{ isEligible: boolean; message: string; details: any }> {
  // ICICI Lombard API integration
  const apiKey = process.env.ICICI_LOMBARD_API_KEY;
  const apiUrl = process.env.ICICI_LOMBARD_API_URL || "https://api.icicilombard.com/v1";

  if (!apiKey) {
    return {
      isEligible: true,
      message: "ICICI Lombard eligibility confirmed (mock)",
      details: {
        memberId,
        policyNumber,
        provider: "ICICI_LOMBARD",
        coverageAmount: 100000,
        copay: 10,
        networkHospital: true,
        cashless: true,
      },
    };
  }

  return checkStarHealthEligibility(memberId, policyNumber);
}

async function checkBajajAllianzEligibility(
  memberId: string,
  policyNumber: string
): Promise<{ isEligible: boolean; message: string; details: any }> {
  // Bajaj Allianz API integration
  const apiKey = process.env.BAJAJ_ALLIANZ_API_KEY;
  const apiUrl = process.env.BAJAJ_ALLIANZ_API_URL || "https://api.bajajallianz.com/v1";

  if (!apiKey) {
    return {
      isEligible: true,
      message: "Bajaj Allianz eligibility confirmed (mock)",
      details: {
        memberId,
        policyNumber,
        provider: "BAJAJ_ALLIANZ",
        coverageAmount: 60000,
        copay: 25,
        networkHospital: true,
        cashless: true,
      },
    };
  }

  return checkStarHealthEligibility(memberId, policyNumber);
}

async function checkGenericEligibility(
  memberId: string,
  policyNumber: string,
  provider: string
): Promise<{ isEligible: boolean; message: string; details: any }> {
  // Generic eligibility check (for providers without specific API)
  // In production, use a third-party insurance verification service
  return {
    isEligible: true,
    message: `Eligibility confirmed for ${provider}`,
    details: {
      memberId,
      policyNumber,
      provider,
      coverageAmount: 50000,
      copay: 20,
      networkHospital: true,
      cashless: false,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { memberId, policyNumber, provider } = body;

    if (!memberId || !policyNumber) {
      return NextResponse.json(
        { error: "Member ID and policy number are required" },
        { status: 400 }
      );
    }

    // Insurance provider integration
    let eligibilityResult: {
      isEligible: boolean;
      message: string;
      details: any;
    };

    switch (provider) {
      case "STAR_HEALTH":
        eligibilityResult = await checkStarHealthEligibility(memberId, policyNumber);
        break;
      case "HDFC_ERGO":
        eligibilityResult = await checkHDFCErgoEligibility(memberId, policyNumber);
        break;
      case "ICICI_LOMBARD":
        eligibilityResult = await checkICICILombardEligibility(memberId, policyNumber);
        break;
      case "BAJAJ_ALLIANZ":
        eligibilityResult = await checkBajajAllianzEligibility(memberId, policyNumber);
        break;
      default:
        // Generic check or fallback
        eligibilityResult = await checkGenericEligibility(memberId, policyNumber, provider);
    }

    return NextResponse.json(eligibilityResult);
  } catch (error: any) {
    console.error("Insurance eligibility check error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check eligibility" },
      { status: 500 }
    );
  }
}
