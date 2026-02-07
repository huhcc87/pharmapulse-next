// Agora Video Provider for Video Assist
// Integration with Agora RTC SDK

export interface AgoraConfig {
  appId: string;
  appCertificate: string;
}

export interface AgoraTokenResponse {
  token: string;
  channelName: string;
  uid: number;
}

export class AgoraProvider {
  constructor(private config: AgoraConfig) {}

  /**
   * Generate Agora RTC token
   */
  async generateToken(
    channelName: string,
    uid: number = 0
  ): Promise<AgoraTokenResponse> {
    const response = await fetch("/api/video-assist/agora/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelName,
        uid,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate Agora token");
    }

    return response.json();
  }

  /**
   * Get channel statistics
   */
  async getChannelStats(channelName: string): Promise<{
    userCount: number;
    duration: number;
  }> {
    const response = await fetch(`/api/video-assist/agora/channel/${channelName}/stats`);

    if (!response.ok) {
      throw new Error("Failed to get channel stats");
    }

    return response.json();
  }
}
