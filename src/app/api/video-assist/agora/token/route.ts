// POST /api/video-assist/agora/token
// Generate Agora RTC token

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";

// Agora RTC Token generation
// In production, use agora-access-token npm package
function generateAgoraToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number,
  role: "publisher" | "subscriber" = "publisher"
): string {
  // This is a simplified version
  // In production, use Agora's RtcTokenBuilder
  const crypto = require("crypto");
  
  const expirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  const salt = crypto.randomBytes(32);
  
  // Simplified token generation
  // In production, use proper Agora token builder
  const tokenData = {
    appId,
    channelName,
    uid,
    role,
    expirationTime,
  };

  const signature = crypto
    .createHmac("sha256", appCertificate)
    .update(JSON.stringify(tokenData))
    .digest("hex");

  return Buffer.from(JSON.stringify({ ...tokenData, signature })).toString("base64");
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { channelName, uid = 0 } = body;

    if (!channelName) {
      return NextResponse.json(
        { error: "channelName is required" },
        { status: 400 }
      );
    }

    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      return NextResponse.json(
        { error: "Agora credentials not configured" },
        { status: 500 }
      );
    }

    const token = generateAgoraToken(appId, appCertificate, channelName, uid);

    return NextResponse.json({
      token,
      channelName,
      uid,
    });
  } catch (error: any) {
    console.error("Agora token generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate token" },
      { status: 500 }
    );
  }
}
