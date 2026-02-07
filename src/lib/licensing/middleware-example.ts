/**
 * Example: How to use licensing enforcement in API routes
 * 
 * This file shows how to integrate licensing enforcement into your API routes.
 * Copy this pattern to your protected routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkLicenseEnforcement } from "./enforcement";

/**
 * Example 1: Simple route with licensing check
 */
export async function GET(request: NextRequest) {
  // Check license enforcement
  const enforcement = await checkLicenseEnforcement(request);
  
  if (!enforcement.allowed) {
    return NextResponse.json(
      {
        error: enforcement.error?.code || "LICENSE_ERROR",
        message: enforcement.error?.message || "License check failed",
        details: enforcement.error?.details,
      },
      { status: 403 }
    );
  }

  // Your route logic here
  return NextResponse.json({ data: "Protected data" });
}

/**
 * Example 2: Route with custom error handling
 */
export async function POST(request: NextRequest) {
  const enforcement = await checkLicenseEnforcement(request);
  
  if (!enforcement.allowed) {
    // Custom error messages based on error code
    const statusCode = 
      enforcement.error?.code === "UNAUTHORIZED" ? 401 :
      enforcement.error?.code === "LICENSE_NOT_FOUND" ? 404 : 403;

    return NextResponse.json(
      {
        error: enforcement.error?.code,
        message: enforcement.error?.message,
        // Include helpful UI messages
        uiMessage: getUIMessage(enforcement.error?.code),
        details: enforcement.error?.details,
      },
      { status: statusCode }
    );
  }

  // Your route logic here
  const body = await request.json();
  return NextResponse.json({ success: true, data: body });
}

/**
 * Helper: Get user-friendly error messages
 */
function getUIMessage(errorCode?: string): string {
  switch (errorCode) {
    case "LICENSE_INACTIVE":
      return "Your license is not active. Please renew your subscription in Settings → Billing.";
    case "IP_NOT_ALLOWED":
      return "Your IP address is not authorized. Go to Settings → Security & Licensing to update your allowed IP.";
    case "DEVICE_MISMATCH":
      return "This license is locked to another device. Ask the owner to switch devices in Settings → Security & Licensing.";
    case "OWNER_REQUIRED_FOR_FIRST_DEVICE_REG":
      return "No device is registered. Only the owner can register the first device. Please contact the owner.";
    default:
      return "License verification failed. Please contact support.";
  }
}

/**
 * Example 3: Route that allows some actions without license check
 * (e.g., public health check, but protected operations need license)
 */
export async function PUT(request: NextRequest) {
  const body = await request.json();
  
  // Only check license for write operations
  if (body.action === "modify" || body.action === "delete") {
    const enforcement = await checkLicenseEnforcement(request);
    
    if (!enforcement.allowed) {
      return NextResponse.json(
        { error: enforcement.error?.code, message: enforcement.error?.message },
        { status: 403 }
      );
    }
  }

  // Your route logic here
  return NextResponse.json({ success: true });
}
