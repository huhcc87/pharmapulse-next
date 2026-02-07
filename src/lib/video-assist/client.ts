// Video Assist Client
// Handles WebRTC/Twilio/Agora integration for real-time video calls

import type { VideoCallRequest, VideoCallResponse, VideoCallProvider } from "./types";

const VIDEO_ASSIST_API_BASE = "/api/video-assist";

/**
 * Initiate a video call
 */
export async function initiateVideoCall(
  request: VideoCallRequest
): Promise<VideoCallResponse> {
  const response = await fetch(`${VIDEO_ASSIST_API_BASE}/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to initiate video call");
  }

  return response.json();
}

/**
 * Get call status
 */
export async function getCallStatus(callId: string): Promise<VideoCallResponse> {
  const response = await fetch(`${VIDEO_ASSIST_API_BASE}/calls/${callId}/status`);

  if (!response.ok) {
    throw new Error("Failed to get call status");
  }

  return response.json();
}

/**
 * End a video call
 */
export async function endVideoCall(callId: string, notes?: string): Promise<void> {
  await fetch(`${VIDEO_ASSIST_API_BASE}/calls/${callId}/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
}

/**
 * Get availability status of support staff
 */
export async function getAvailabilityStatus(): Promise<Array<{
  userId: string;
  userName: string;
  role: string;
  isAvailable: boolean;
  currentCallId?: string;
}>> {
  const response = await fetch(`${VIDEO_ASSIST_API_BASE}/availability`);

  if (!response.ok) {
    throw new Error("Failed to get availability status");
  }

  return response.json();
}

/**
 * Join a video call (for receiver)
 */
export async function joinVideoCall(callId: string): Promise<VideoCallResponse> {
  const response = await fetch(`${VIDEO_ASSIST_API_BASE}/calls/${callId}/join`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to join video call");
  }

  return response.json();
}

/**
 * Get call history
 */
export async function getCallHistory(limit: number = 50): Promise<Array<{
  id: string;
  callId: string;
  context: string;
  participants: Array<{ userName: string; role: string }>;
  status: string;
  duration?: number;
  createdAt: string;
}>> {
  const response = await fetch(`${VIDEO_ASSIST_API_BASE}/calls/history?limit=${limit}`);

  if (!response.ok) {
    throw new Error("Failed to get call history");
  }

  return response.json();
}
