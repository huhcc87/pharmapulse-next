/**
 * Analytics Step-Up Authentication API
 * 
 * POST /api/security/stepup/analytics/start - Start step-up challenge
 * POST /api/security/stepup/analytics/verify - Verify and get unlock token
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import {
  startAnalyticsStepUp,
  verifyAnalyticsStepUp,
  isAnalyticsStepUpRequired,
  getAnalyticsUnlockToken,
} from "@/lib/security/analytics-stepup";
import { logAnalyticsAudit } from "@/lib/audit/analytics-audit";
import { extractClientIP } from "@/lib/licensing/ip-extraction";
import { z } from "zod";

const startSchema = z.object({
  method: z.enum(['email_otp', 'totp', 'analytics_pin']).optional(),
});

const verifySchema = z.object({
  challengeId: z.string(),
  code: z.string(),
});

// POST /api/security/stepup/analytics/start
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await request.json();
    const { method = 'email_otp' } = startSchema.parse(body);

    // Check if step-up is required
    // For now, always require (you can add logic to check session age, device, IP)
    const stepUpRequired = await isAnalyticsStepUpRequired(
      user.tenantId,
      user.userId,
      user.role,
      0, // sessionAgeHours - get from session
      false, // isNewDevice - check from device tracking
      false // ipChanged - check from IP tracking
    );

    if (!stepUpRequired) {
      // Return existing token if valid
      const existingToken = await getAnalyticsUnlockToken(user.tenantId, user.userId);
      if (existingToken) {
        return NextResponse.json({
          success: true,
          token: existingToken,
          message: 'Valid unlock token found',
        });
      }
    }

    const challenge = await startAnalyticsStepUp(
      user.tenantId,
      user.userId,
      method,
      extractClientIP(request),
      request.headers.get('user-agent') || undefined
    );

    return NextResponse.json({
      success: true,
      challengeId: challenge.challengeId,
      method: challenge.method,
      expiresAt: challenge.expiresAt,
      message: method === 'email_otp' 
        ? 'OTP sent to your email'
        : method === 'totp'
        ? 'Enter TOTP code from your authenticator app'
        : 'Enter your Analytics PIN',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Analytics step-up start error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start step-up authentication' },
      { status: 500 }
    );
  }
}

// POST /api/security/stepup/analytics/verify
export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await request.json();
    const { challengeId, code } = verifySchema.parse(body);

    const result = await verifyAnalyticsStepUp(
      challengeId,
      code,
      user.tenantId,
      user.userId
    );

    if (!result.success) {
      // Log failed attempt
      await logAnalyticsAudit(
        user.tenantId,
        user.userId,
        'ANALYTICS_STEPUP_FAILED',
        { challengeId },
        extractClientIP(request),
        request.headers.get('user-agent') || undefined
      );

      return NextResponse.json(
        { error: 'Invalid code. Please try again.' },
        { status: 401 }
      );
    }

    // Log success
    await logAnalyticsAudit(
      user.tenantId,
      user.userId,
      'ANALYTICS_STEPUP_SUCCESS',
      { challengeId },
      extractClientIP(request),
      request.headers.get('user-agent') || undefined
    );

    return NextResponse.json({
      success: true,
      token: result.token,
      expiresAt: result.expiresAt,
      message: 'Analytics unlocked successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Analytics step-up verify error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify step-up authentication' },
      { status: 500 }
    );
  }
}
