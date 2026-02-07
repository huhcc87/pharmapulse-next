"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PhoneOff, Video, Users, Clock } from "lucide-react";
import { getCallStatus, endVideoCall } from "@/lib/video-assist/client";
import { showToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

export default function VideoCallPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params?.callId as string;
  
  const [callStatus, setCallStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!callId) {
      router.push("/pos");
      return;
    }

    // Load call status
    loadCallStatus();

    // Poll call status every 3 seconds
    const interval = setInterval(() => {
      loadCallStatus();
    }, 3000);

    // Track duration if connected
    let durationInterval: NodeJS.Timeout | null = null;
    if (callStatus?.status === "CONNECTED") {
      durationInterval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }

    return () => {
      clearInterval(interval);
      if (durationInterval) clearInterval(durationInterval);
    };
  }, [callId, callStatus?.status]);

  async function loadCallStatus() {
    try {
      const status = await getCallStatus(callId);
      setCallStatus(status);
      setIsLoading(false);

      if (status.status === "ENDED" || status.status === "FAILED") {
        showToast("Call ended", "info");
        setTimeout(() => {
          router.push("/pos");
        }, 2000);
      }
    } catch (error: any) {
      console.error("Failed to load call status:", error);
      setIsLoading(false);
      showToast("Call not found", "error");
      setTimeout(() => {
        router.push("/pos");
      }, 2000);
    }
  }

  async function handleEndCall() {
    try {
      await endVideoCall(callId);
      showToast("Call ended", "success");
      router.push("/pos");
    } catch (error: any) {
      showToast(error.message || "Failed to end call", "error");
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading call...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Video className="w-5 h-5 text-blue-400" />
            <div>
              <h1 className="text-lg font-semibold">
                Video Call: {callId}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className={`w-2 h-2 rounded-full ${
                  callStatus?.status === "CONNECTED" ? "bg-green-500" : 
                  callStatus?.status === "RINGING" ? "bg-yellow-500 animate-pulse" : 
                  "bg-gray-500"
                }`}></div>
                <span>{callStatus?.status || "Unknown"}</span>
                {callStatus?.status === "CONNECTED" && duration > 0 && (
                  <>
                    <span>•</span>
                    <Clock className="w-3 h-3" />
                    <span>{formatDuration(duration)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <Button
            onClick={handleEndCall}
            variant="destructive"
            className="flex items-center gap-2"
          >
            <PhoneOff className="w-4 h-4" />
            End Call
          </Button>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-4xl">
          <div className="bg-gray-800 rounded-lg p-6 mb-4">
            <h2 className="text-xl font-semibold mb-4">Call Information</h2>
            
            {/* Participants */}
            {callStatus?.participants && callStatus.participants.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Participants:</h3>
                <div className="space-y-2">
                  {callStatus.participants.map((p: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-gray-700 rounded">
                      <div className={`w-3 h-3 rounded-full ${
                        p.status === "JOINED" ? "bg-green-500" : "bg-gray-500"
                      }`}></div>
                      <div className="flex-1">
                        <div className="font-medium">
                          {p.userName || p.role || "Unknown"}
                          {p.role && p.userName !== p.role && (
                            <span className="text-gray-400 ml-2">({p.role})</span>
                          )}
                        </div>
                        {p.email && (
                          <div className="text-sm text-gray-400">{p.email}</div>
                        )}
                        {p.userId && (
                          <div className="text-xs text-gray-500">User ID: {p.userId}</div>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        p.status === "JOINED" ? "bg-green-900 text-green-300" :
                        p.status === "INVITED" ? "bg-yellow-900 text-yellow-300" :
                        "bg-gray-600 text-gray-300"
                      }`}>
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Call Context */}
            {callStatus?.context && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Context:</h3>
                <p className="text-gray-300">{callStatus.context}</p>
              </div>
            )}

            {/* Meeting URL */}
            {callStatus?.meetingUrl && (
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Meeting URL:</h3>
                <code className="block p-2 bg-gray-700 rounded text-sm text-gray-300 break-all">
                  {callStatus.meetingUrl}
                </code>
              </div>
            )}

            {/* Video Placeholder */}
            <div className="bg-gray-700 rounded-lg p-12 text-center">
              <Video className="w-16 h-16 mx-auto mb-4 text-gray-500" />
              <p className="text-gray-400">
                {callStatus?.status === "RINGING" 
                  ? "Call is ringing. Waiting for participant to join..."
                  : callStatus?.status === "CONNECTED"
                  ? "Video call in progress. This is a placeholder for video integration."
                  : "Call status: " + (callStatus?.status || "Unknown")}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                To integrate video, connect a provider (Twilio, Agora, WebRTC) in the API route.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{callStatus?.participants?.length || 0} participants</span>
          </div>
          {callStatus?.provider && (
            <div className="flex items-center gap-2">
              <span>Provider: {callStatus.provider}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
