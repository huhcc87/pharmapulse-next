// POST /api/video-assist/twilio/token
// Generate Twilio access token for video room

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";

// Twilio Access Token generation
// In production, use @twilio/video SDK or twilio npm package
function generateTwilioToken(
  accountSid: string,
  apiKey: string,
  apiSecret: string,
  identity: string,
  roomName: string
): string {
  // This is a simplified version
  // In production, use Twilio's AccessToken class
  const jwt = require("jsonwebtoken");
  
  const token = jwt.sign(
    {
      jti: `${apiKey}-${Date.now()}`,
      iss: apiKey,
      sub: accountSid,
      grants: {
        identity: identity,
        video: {
          room: roomName,
        },
      },
    },
    apiSecret,
    {
      algorithm: "HS256",
      expiresIn: "1h",
    }
  );

  return token;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { identity, roomName } = body;

    if (!identity || !roomName) {
      return NextResponse.json(
        { error: "identity and roomName are required" },
        { status: 400 }
      );
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;

    if (!accountSid || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Twilio credentials not configured" },
        { status: 500 }
      );
    }

    const token = generateTwilioToken(accountSid, apiKey, apiSecret, identity, roomName);

    return NextResponse.json({
      token,
      roomName,
    });
  } catch (error: any) {
    console.error("Twilio token generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate token" },
      { status: 500 }
    );
  }
}
