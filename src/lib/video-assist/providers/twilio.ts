// Twilio Video Provider for Video Assist
// Integration with Twilio Video Rooms API

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  apiKey: string;
  apiSecret: string;
}

export interface TwilioTokenResponse {
  token: string;
  roomName: string;
  roomSid?: string;
}

export class TwilioProvider {
  constructor(private config: TwilioConfig) {}

  /**
   * Generate Twilio access token for video room
   */
  async generateAccessToken(
    identity: string,
    roomName: string
  ): Promise<TwilioTokenResponse> {
    // In production, generate token server-side
    // For now, return structure for client-side generation
    const response = await fetch("/api/video-assist/twilio/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identity,
        roomName,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate Twilio token");
    }

    return response.json();
  }

  /**
   * Create a Twilio video room
   */
  async createRoom(roomName: string): Promise<{ roomSid: string; roomName: string }> {
    const response = await fetch("/api/video-assist/twilio/room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName }),
    });

    if (!response.ok) {
      throw new Error("Failed to create Twilio room");
    }

    return response.json();
  }

  /**
   * Get room status
   */
  async getRoomStatus(roomSid: string): Promise<{
    status: string;
    participants: number;
  }> {
    const response = await fetch(`/api/video-assist/twilio/room/${roomSid}/status`);

    if (!response.ok) {
      throw new Error("Failed to get room status");
    }

    return response.json();
  }

  /**
   * End/disconnect from room
   */
  async endRoom(roomSid: string): Promise<void> {
    await fetch(`/api/video-assist/twilio/room/${roomSid}/end`, {
      method: "POST",
    });
  }
}
