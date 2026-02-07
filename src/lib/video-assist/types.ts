// Video Assist (Pharma Assist) Types
// Context-aware video call system for pharmacy staff support

export type VideoCallProvider = "WEBRTC" | "TWILIO" | "AGORA" | "ZOOM" | "GOOGLE_MEET";

export type VideoCallStatus = "INITIATING" | "RINGING" | "CONNECTED" | "ENDED" | "FAILED" | "MISSED";

export type VideoCallContext = "POS" | "INVENTORY" | "PRESCRIPTION" | "GENERAL";

export interface VideoCallRequest {
  context: VideoCallContext;
  contextData?: {
    // POS context
    cartItems?: Array<{ productName: string; quantity: number }>;
    customerId?: number;
    totalAmountPaise?: number;
    
    // Inventory context
    productId?: number;
    productName?: string;
    batchCode?: string;
    issue?: string;
    
    // Prescription context
    prescriptionId?: number;
    patientName?: string;
    drugNames?: string[];
    
    // General
    reason?: string;
    preCallMessage?: string;
  };
  requestedBy: string; // User ID
  requestedRole?: string; // Role of requester
  targetRole?: string; // Target role (owner, pharmacist, etc.)
  tenantId: number;
}

export interface VideoCallResponse {
  callId: string;
  status: VideoCallStatus;
  provider: VideoCallProvider;
  meetingUrl?: string;
  meetingId?: string;
  accessToken?: string; // For WebRTC/Twilio
  roomName?: string; // For Agora
  participants: Array<{
    userId: string;
    role: string;
    status: "INVITED" | "JOINED" | "LEFT";
    userName?: string;
    email?: string;
  }>;
  context: VideoCallContext;
  contextData?: VideoCallRequest["contextData"];
  startedAt?: Date;
  endedAt?: Date;
  duration?: number; // seconds
  error?: string;
}

export interface VideoCallLog {
  id: string;
  callId: string;
  tenantId: number;
  context: VideoCallContext;
  contextData?: any;
  participants: Array<{
    userId: string;
    userName: string;
    role: string;
    joinedAt?: Date;
    leftAt?: Date;
  }>;
  status: VideoCallStatus;
  duration?: number;
  reason?: string;
  postCallNotes?: string;
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
}

export interface AvailabilityStatus {
  userId: string;
  userName: string;
  role: string;
  isAvailable: boolean;
  currentCallId?: string;
  lastSeen?: Date;
  statusMessage?: string;
}
