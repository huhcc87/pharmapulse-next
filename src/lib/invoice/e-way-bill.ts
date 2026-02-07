// E-Way Bill Generation
// Generates E-Way Bill for inter-state movement of goods >₹50,000

export interface EWayBillGenerateRequest {
  invoice: any; // Invoice with line items
  transporterGstin?: string;
  vehicleNumber?: string;
  distance?: number; // in kilometers
  transportMode?: "ROAD" | "RAIL" | "AIR" | "SHIP";
  transporterName?: string;
}

export interface EWayBillGenerateResponse {
  success: boolean;
  eWayBillNumber?: string;
  eWayBillValidUpto?: Date;
  qrCode?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Generate E-Way Bill for invoice
 * 
 * Note: This is a placeholder implementation. To use in production:
 * 1. Register with E-Way Bill Portal (https://ewaybillgst.gov.in)
 * 2. Obtain credentials (username, password, GSTIN)
 * 3. Implement authentication (OAuth2 or basic auth as per portal)
 * 4. Replace mock implementation with actual API calls
 * 
 * E-Way Bill API Endpoint: https://ewaybillgst.gov.in/api/auth
 * Documentation: https://ewaybillgst.gov.in/help
 */
export async function generateEWayBill(
  request: EWayBillGenerateRequest
): Promise<EWayBillGenerateResponse> {
  const { invoice, transporterGstin, vehicleNumber, distance, transportMode = "ROAD" } = request;

  // Validate invoice
  if (!invoice.invoiceNumber) {
    return {
      success: false,
      error: "Invoice number is required",
      errorCode: "MISSING_INVOICE_NUMBER",
    };
  }

  // Check if invoice value is >= ₹50,000 (E-Way Bill threshold)
  const invoiceValue = invoice.totalInvoicePaise / 100; // Convert paise to rupees
  if (invoiceValue < 50000) {
    return {
      success: false,
      error: "E-Way Bill not required for invoices < ₹50,000",
      errorCode: "BELOW_THRESHOLD",
    };
  }

  // Check if inter-state (required for E-Way Bill)
  const sellerStateCode = invoice.placeOfSupplyStateCode || invoice.sellerGstin?.stateCode;
  const buyerStateCode = invoice.placeOfSupply?.split("-")[0] || invoice.buyerGstin?.substring(0, 2);
  
  if (sellerStateCode === buyerStateCode) {
    // Intra-state - E-Way Bill not mandatory (but can be generated optionally)
    // In practice, some businesses generate for intra-state > ₹50,000
  }

  // Build E-Way Bill payload
  const payload = buildEWayBillPayload(invoice, {
    transporterGstin,
    vehicleNumber,
    distance,
    transportMode,
  });

  // TODO: Replace with actual E-Way Bill API call
  // For now, this is a mock implementation
  const EWB_API_BASE = process.env.EWAYBILL_API_BASE || "https://ewaybillgst.gov.in";
  const EWB_USERNAME = process.env.EWAYBILL_USERNAME;
  const EWB_PASSWORD = process.env.EWAYBILL_PASSWORD;

  if (!EWB_USERNAME || !EWB_PASSWORD) {
    // Return mock response for development/testing
    console.warn("E-Way Bill credentials not configured. Returning mock E-Way Bill number.");
    const mockEwayBillNumber = `EWB-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const validUpto = new Date();
    validUpto.setDate(validUpto.getDate() + 1); // Valid for 1 day

    return {
      success: true,
      eWayBillNumber: mockEwayBillNumber,
      eWayBillValidUpto: validUpto,
      qrCode: `https://ewaybillgst.gov.in/verify?ewb=${mockEwayBillNumber}`,
    };
  }

  try {
    // Step 1: Authenticate with E-Way Bill Portal
    const authResponse = await fetch(`${EWB_API_BASE}/api/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: EWB_USERNAME,
        password: EWB_PASSWORD,
        gstin: invoice.sellerGstin?.gstin || invoice.sellerGstinId,
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

    // Step 2: Generate E-Way Bill
    const ewbResponse = await fetch(`${EWB_API_BASE}/api/ewaybill/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!ewbResponse.ok) {
      const errorData = await ewbResponse.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || "E-Way Bill generation failed",
        errorCode: errorData.errorCode || "EWAYBILL_GENERATION_FAILED",
      };
    }

    const ewbData = await ewbResponse.json();

    return {
      success: true,
      eWayBillNumber: ewbData.ewbNo || ewbData.eWayBillNumber,
      eWayBillValidUpto: ewbData.validUpto ? new Date(ewbData.validUpto) : new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day validity
      qrCode: ewbData.qrCode || `https://ewaybillgst.gov.in/verify?ewb=${ewbData.ewbNo}`,
    };
  } catch (error: any) {
    console.error("E-Way Bill generation error:", error);
    return {
      success: false,
      error: error.message || "Unknown error occurred",
      errorCode: "API_ERROR",
    };
  }
}

/**
 * Build E-Way Bill payload from invoice
 */
function buildEWayBillPayload(
  invoice: any,
  options: {
    transporterGstin?: string;
    vehicleNumber?: string;
    distance?: number;
    transportMode?: string;
  }
): any {
  const { transporterGstin, vehicleNumber, distance, transportMode } = options;

  // Calculate total invoice value (for E-Way Bill)
  const invoiceValue = invoice.totalInvoicePaise / 100;

  return {
    fromGstin: invoice.sellerGstin?.gstin || invoice.sellerGstinId?.toString(),
    fromStateCode: invoice.placeOfSupplyStateCode || invoice.sellerGstin?.stateCode,
    toGstin: invoice.buyerGstin || null,
    toStateCode: invoice.placeOfSupply?.split("-")[0] || null,
    invoiceNo: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    invoiceValue: invoiceValue,
    transportMode: transportMode || "ROAD",
    transporterGstin: transporterGstin || null,
    vehicleNumber: vehicleNumber || null,
    distance: distance || null,
    itemList: invoice.lineItems?.map((item: any) => ({
      hsnCode: item.hsnCode || "",
      quantity: item.quantity,
      rate: (item.unitPricePaise / 100).toFixed(2),
      taxableValue: ((item.taxablePaise || item.unitPricePaise * item.quantity) / 100).toFixed(2),
      cgst: ((item.cgstPaise || 0) / 100).toFixed(2),
      sgst: ((item.sgstPaise || 0) / 100).toFixed(2),
      igst: ((item.igstPaise || 0) / 100).toFixed(2),
    })) || [],
  };
}

/**
 * Cancel E-Way Bill
 */
export async function cancelEWayBill(
  eWayBillNumber: string,
  reason: string = "Invoice cancelled"
): Promise<{ success: boolean; error?: string }> {
  // TODO: Implement E-Way Bill cancellation API call
  console.warn("E-Way Bill cancellation not yet implemented");
  return {
    success: false,
    error: "E-Way Bill cancellation not yet implemented",
  };
}
