// E-Invoice NIC API Integration
// Integrates with NIC e-Invoice Portal: https://einvoice.gst.gov.in

import { buildEInvoicePayload } from "./e-invoice";

export interface EInvoiceGenerateRequest {
  invoice: any;
  sellerGstin: any;
  org: any;
}

export interface EInvoiceGenerateResponse {
  success: boolean;
  irn?: string;
  qrCode?: string;
  ackNo?: string;
  ackDate?: Date;
  error?: string;
  errorCode?: string;
}

export interface EInvoiceCancelRequest {
  irn: string;
  cancelReason: string;
  remark: string;
}

export interface EInvoiceCancelResponse {
  success: boolean;
  cancelDate?: Date;
  error?: string;
  errorCode?: string;
}

/**
 * Generate E-Invoice IRN from NIC API
 * 
 * Note: This is a placeholder implementation. To use in production:
 * 1. Register with NIC e-Invoice Portal
 * 2. Obtain credentials (username, password, GSTIN)
 * 3. Implement authentication (OAuth2 or basic auth as per NIC)
 * 4. Replace mock implementation with actual API calls
 * 
 * NIC API Endpoint: https://einvoice.gst.gov.in/api/auth
 * Documentation: https://einvoice.gst.gov.in/help
 */
export async function generateEInvoiceIRN(
  request: EInvoiceGenerateRequest
): Promise<EInvoiceGenerateResponse> {
  const { invoice, sellerGstin, org } = request;

  // Validate required fields
  if (!invoice.invoiceNumber) {
    return {
      success: false,
      error: "Invoice number is required",
      errorCode: "MISSING_INVOICE_NUMBER",
    };
  }

  if (!sellerGstin?.gstin) {
    return {
      success: false,
      error: "Seller GSTIN is required",
      errorCode: "MISSING_GSTIN",
    };
  }

  // Build E-Invoice payload
  const payload = buildEInvoicePayload(invoice, sellerGstin, org);

  // TODO: Replace with actual NIC API call
  // For now, this is a mock implementation
  const NIC_API_BASE = process.env.NIC_EINVOICE_API_BASE || "https://einvoice.gst.gov.in";
  const NIC_USERNAME = process.env.NIC_EINVOICE_USERNAME;
  const NIC_PASSWORD = process.env.NIC_EINVOICE_PASSWORD;

  if (!NIC_USERNAME || !NIC_PASSWORD) {
    // Return mock response for development/testing
    console.warn("NIC E-Invoice credentials not configured. Returning mock IRN.");
    return {
      success: true,
      irn: `MOCK-IRN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      qrCode: `https://einvoice.gst.gov.in/verify?irn=MOCK-IRN-${Date.now()}`,
      ackNo: `ACK-${Date.now()}`,
      ackDate: new Date(),
    };
  }

  try {
    // Step 1: Authenticate with NIC
    const authResponse = await fetch(`${NIC_API_BASE}/api/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: NIC_USERNAME,
        password: NIC_PASSWORD,
        gstin: sellerGstin.gstin,
      }),
    });

    if (!authResponse.ok) {
      const errorData = await authResponse.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || "Authentication failed",
        errorCode: "AUTH_FAILED",
      };
    }

    const authData = await authResponse.json();
    const token = authData.token || authData.access_token;

    // Step 2: Generate IRN
    const irnResponse = await fetch(`${NIC_API_BASE}/api/invoice/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!irnResponse.ok) {
      const errorData = await irnResponse.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || "IRN generation failed",
        errorCode: errorData.errorCode || "IRN_GENERATION_FAILED",
      };
    }

    const irnData = await irnResponse.json();

    return {
      success: true,
      irn: irnData.Irn || irnData.IRN,
      qrCode: irnData.QRCode || irnData.qrCode,
      ackNo: irnData.AckNo || irnData.ackNo,
      ackDate: irnData.AckDt ? new Date(irnData.AckDt) : new Date(),
    };
  } catch (error: any) {
    console.error("E-Invoice IRN generation error:", error);
    return {
      success: false,
      error: error.message || "Unknown error occurred",
      errorCode: "API_ERROR",
    };
  }
}

/**
 * Cancel E-Invoice IRN
 */
export async function cancelEInvoiceIRN(
  request: EInvoiceCancelRequest
): Promise<EInvoiceCancelResponse> {
  const { irn, cancelReason, remark } = request;

  const NIC_API_BASE = process.env.NIC_EINVOICE_API_BASE || "https://einvoice.gst.gov.in";
  const NIC_USERNAME = process.env.NIC_EINVOICE_USERNAME;
  const NIC_PASSWORD = process.env.NIC_EINVOICE_PASSWORD;

  if (!NIC_USERNAME || !NIC_PASSWORD) {
    console.warn("NIC E-Invoice credentials not configured. Returning mock cancel.");
    return {
      success: true,
      cancelDate: new Date(),
    };
  }

  try {
    // Authenticate
    const authResponse = await fetch(`${NIC_API_BASE}/api/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: NIC_USERNAME,
        password: NIC_PASSWORD,
      }),
    });

    if (!authResponse.ok) {
      return {
        success: false,
        error: "Authentication failed",
        errorCode: "AUTH_FAILED",
      };
    }

    const authData = await authResponse.json();
    const token = authData.token || authData.access_token;

    // Cancel IRN
    const cancelResponse = await fetch(`${NIC_API_BASE}/api/invoice/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        Irn: irn,
        CancelRsn: cancelReason,
        Remark: remark,
      }),
    });

    if (!cancelResponse.ok) {
      const errorData = await cancelResponse.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || "IRN cancellation failed",
        errorCode: errorData.errorCode || "CANCEL_FAILED",
      };
    }

    const cancelData = await cancelResponse.json();

    return {
      success: true,
      cancelDate: cancelData.CancelDt ? new Date(cancelData.CancelDt) : new Date(),
    };
  } catch (error: any) {
    console.error("E-Invoice IRN cancellation error:", error);
    return {
      success: false,
      error: error.message || "Unknown error occurred",
      errorCode: "API_ERROR",
    };
  }
}
