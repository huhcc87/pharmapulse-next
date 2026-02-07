"use client";

import { useState, useEffect, useRef } from "react";
import { Video, Phone, PhoneOff, Users, Clock, RotateCcw, X } from "lucide-react";
import type { VideoCallContext, VideoCallRequest, VideoCallResponse } from "@/lib/video-assist/types";
import { initiateVideoCall, getAvailabilityStatus, endVideoCall, getCallStatus } from "@/lib/video-assist/client";
import { showToast } from "@/lib/toast";

interface VideoAssistButtonProps {
  context: VideoCallContext;
  contextData?: VideoCallRequest["contextData"];
  className?: string;
  tenantId: number;
  userId: string;
  userRole?: string;
}

export default function VideoAssistButton({
  context,
  contextData,
  className = "",
  tenantId,
  userId,
  userRole,
}: VideoAssistButtonProps) {
  const [isCalling, setIsCalling] = useState(false);
  const [activeCall, setActiveCall] = useState<VideoCallResponse | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [availability, setAvailability] = useState<Array<{
    userId: string;
    userName: string;
    role: string;
    isAvailable: boolean;
  }>>([]);
  const [showModal, setShowModal] = useState(false);
  const [showCallControls, setShowCallControls] = useState(false);
  const callStatusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load availability status - wrapped in try-catch to prevent crashes
    try {
      loadAvailability();
      const interval = setInterval(() => {
        try {
          loadAvailability();
        } catch (error) {
          console.error("Error in availability interval:", error);
        }
      }, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    } catch (error) {
      console.error("Error setting up availability check:", error);
    }
  }, []);

  // Poll call status when there's an active call
  useEffect(() => {
    if (activeCall && (activeCall.status === "RINGING" || activeCall.status === "CONNECTED")) {
      // Poll call status every 5 seconds
      callStatusIntervalRef.current = setInterval(async () => {
        try {
          const status = await getCallStatus(activeCall.callId);
          setActiveCall(status);
          
          // If call ended, clear intervals
          if (status && (status.status === "ENDED" || status.status === "FAILED")) {
            if (callStatusIntervalRef.current) {
              clearInterval(callStatusIntervalRef.current);
              callStatusIntervalRef.current = null;
            }
            if (durationIntervalRef.current) {
              clearInterval(durationIntervalRef.current);
              durationIntervalRef.current = null;
            }
            setCallDuration(0);
            setActiveCall(null);
            showToast("Call ended", "info");
          } else if (status) {
            setActiveCall(status);
          }
        } catch (error) {
          console.error("Error polling call status:", error);
        }
      }, 5000);

      // Track call duration
      if (activeCall.status === "CONNECTED") {
        durationIntervalRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
      }
    }

    return () => {
      if (callStatusIntervalRef.current) {
        clearInterval(callStatusIntervalRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [activeCall]);

  async function loadAvailability() {
    try {
      // Only run on client side
      if (typeof window === "undefined") return;
      
      const status = await getAvailabilityStatus();
      setAvailability(status);
    } catch (error) {
      console.error("Failed to load availability:", error);
      // Don't block the button if availability check fails
      // Set empty array so button is still usable
      setAvailability([]);
    }
  }

  async function handleInitiateCall() {
    if (isCalling || activeCall) return;

    setIsCalling(true);
    try {
      const request: VideoCallRequest = {
        context,
        contextData,
        requestedBy: userId,
        requestedRole: userRole,
        tenantId,
      };

      const response = await initiateVideoCall(request);
      setActiveCall(response);
      setIsCalling(false);

      if (response.status === "RINGING") {
        showToast("Call initiated. Waiting for response...", "info");
      } else if (response.status === "CONNECTED") {
        showToast("Call connected!", "success");
        // Open video call window
        if (response.meetingUrl) {
          window.open(response.meetingUrl, "_blank", "width=800,height=600");
        }
      }
    } catch (error: any) {
      setIsCalling(false);
      showToast(error.message || "Failed to initiate call", "error");
    }
  }

  async function handleEndCall() {
    if (!activeCall) return;

    try {
      await endVideoCall(activeCall.callId, "Ended by user");
      
      // Clear intervals
      if (callStatusIntervalRef.current) {
        clearInterval(callStatusIntervalRef.current);
        callStatusIntervalRef.current = null;
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      
      setActiveCall(null);
      setCallDuration(0);
      setShowCallControls(false);
      showToast("Call ended successfully", "success");
    } catch (error: any) {
      showToast(error.message || "Failed to end call", "error");
      // Still clear the call state even if API call fails
      setActiveCall(null);
      setCallDuration(0);
      setShowCallControls(false);
    }
  }

  async function handleRecall() {
    if (activeCall) {
      // End current call first
      try {
        await endVideoCall(activeCall.callId, "Recalling");
      } catch (error) {
        console.error("Error ending call for recall:", error);
      }
    }
    
    // Wait a moment then initiate new call
    setTimeout(() => {
      handleInitiateCall();
    }, 500);
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  const availableStaff = availability.filter((a) => a.isAvailable);
  const hasAvailableStaff = availableStaff.length > 0;

  // Always render the button
  return (
    <div className={`relative ${className}`} data-testid="video-assist-button">
      {/* Main button */}
      <button
        onClick={() => {
          if (activeCall) {
            setShowCallControls(!showCallControls);
          } else {
            handleInitiateCall();
          }
        }}
        disabled={isCalling}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
          ${isCalling
            ? "bg-gray-400 cursor-not-allowed"
            : activeCall
            ? "bg-red-600 hover:bg-red-700 text-white"
            : hasAvailableStaff
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-blue-500 hover:bg-blue-600 text-white opacity-75"
          }
        `}
        title={
          !hasAvailableStaff
            ? "No staff available (will try to connect anyway)"
            : activeCall
            ? "Click to show call controls"
            : "Initiate video call with pharmacist/owner"
        }
        style={{ minWidth: '140px', display: 'flex' }}
      >
        {activeCall ? (
          <>
            <Phone className="w-4 h-4" />
            <span>Call Active</span>
          </>
        ) : (
          <>
            <Video className="w-4 h-4" />
            <span>Video Assist</span>
          </>
        )}
      </button>

      {/* Call Controls Panel */}
      {activeCall && showCallControls && (
        <div className="absolute top-full mt-2 left-0 bg-white border border-gray-300 rounded-lg shadow-xl p-4 z-50 min-w-[280px]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                activeCall?.status === "CONNECTED" ? "bg-green-500" : 
                activeCall?.status === "RINGING" ? "bg-yellow-500 animate-pulse" : 
                "bg-gray-400"
              }`}></div>
              <span className="text-sm font-semibold">
                {activeCall?.status === "CONNECTED" ? "Connected" : 
                 activeCall?.status === "RINGING" ? "Ringing..." : 
                 activeCall?.status || "Unknown"}
              </span>
            </div>
            <button
              onClick={() => setShowCallControls(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Call Duration */}
          {activeCall?.status === "CONNECTED" && callDuration > 0 && (
            <div className="text-xs text-gray-600 mb-3 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Duration: {formatDuration(callDuration)}</span>
            </div>
          )}

          {/* Participants Info */}
          {activeCall?.participants && activeCall.participants.length > 0 && (
            <div className="text-xs text-gray-600 mb-3">
              <div className="font-semibold mb-1">Participants:</div>
              {activeCall.participants.map((p: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${
                    p.status === "JOINED" ? "bg-green-500" : "bg-gray-400"
                  }`}></div>
                  <div className="flex-1">
                    <div className="font-medium">
                      {p.userName || p.role || "Unknown"} 
                      {p.role && p.userName !== p.role && (
                        <span className="text-gray-500"> ({p.role})</span>
                      )}
                    </div>
                    {p.email && (
                      <div className="text-gray-500 text-[10px]">{p.email}</div>
                    )}
                    {p.userId && (
                      <div className="text-gray-400 text-[10px]">ID: {p.userId}</div>
                    )}
                    <div className="text-gray-400 text-[10px] mt-0.5">Status: {p.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleEndCall}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Hang Up</span>
            </button>
            <button
              onClick={handleRecall}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              title="Recall/Reconnect"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Meeting URL */}
          {activeCall?.meetingUrl && (
            <button
              onClick={() => {
                if (activeCall?.meetingUrl) {
                  window.open(activeCall.meetingUrl, "_blank", "width=800,height=600");
                }
              }}
              className="mt-2 w-full text-xs text-blue-600 hover:text-blue-800 underline text-center"
            >
              Open Video Window
            </button>
          )}
        </div>
      )}

      {/* Availability indicator */}
      {hasAvailableStaff && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
      )}

      {/* Active call indicator */}
      {activeCall && !showCallControls && (
        <div className="absolute -bottom-8 left-0 right-0 text-xs text-center text-gray-600">
          <div className="flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" />
            <span>
              {activeCall?.status === "CONNECTED" && callDuration > 0 
                ? `Call: ${formatDuration(callDuration)}`
                : activeCall?.status === "RINGING" 
                ? "Ringing..."
                : "Call in progress..."}
            </span>
          </div>
        </div>
      )}

      {/* Availability tooltip */}
      {showModal && (
        <div className="absolute bottom-full mb-2 left-0 bg-white border rounded-lg shadow-lg p-3 min-w-[200px] z-50">
          <div className="text-sm font-semibold mb-2">Available Staff</div>
          {availableStaff.length === 0 ? (
            <div className="text-xs text-gray-500">No staff available</div>
          ) : (
            <div className="space-y-1">
              {availableStaff.map((staff) => (
                <div key={staff.userId} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>{staff.userName}</span>
                  <span className="text-gray-500">({staff.role})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
