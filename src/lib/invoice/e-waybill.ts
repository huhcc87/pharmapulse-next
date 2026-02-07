// E-Way Bill Generation
// Integrates with E-Way Bill Portal: https://ewaybillgst.gov.in

export interface EWayBillGenerateRequest {
  invoice: any;
  invoiceLineItems: any[];
  transporterGstin?: string;
  vehicleNumber: string;
  distance: number; // in kilometers
  transportMode: "Road" | "Rail" | "Air" | "Ship";
  transporterName?: string;
  transporterDocNo?: string;
  transporterDocDate?: Date;
}

export interface EWayBillGenerateResponse {
  success: boolean;
  ewbNo?: string;
  validUpto?: Date;
  error?: string;
  errorCode?: string;
}

export interface EWayBillCancelRequest {
  ewbNo: string;
  cancelReason: number; // 1-4 (as per GST rules)
  remark: string;
}

export interface EWayBillCancelResponse {
  success: boolean;
  cancelDate?: Date;
  error?: string;
  errorCode?: string;
}

/**
 * Generate E-Way Bill
 * 
 * Note: This is a placeholder implementation. To use in production:
 * 1. Register with E-Way Bill Portal
 * 2. Obtain credentials (username, password, GSTIN)
 * 3. Implement authentication (OAuth2 as per portal)
 * 4. Replace mock implementation with actual API calls
 * 
 * E-Way Bill API Endpoint: https://ewaybillgst.gov.in/api/auth
 * Documentation: https://ewaybillgst.gov.in/help
 * 
 * E-Way Bill is required for:
 * - Inter-state movement of goods >₹50,000
 * - Intra-state movement >₹50,000 (if state requires)
 */
export async function generateEWayBill(
  request: EWayBillGenerateRequest
): Promise<EWayBillGenerateResponse> {
  const { invoice, invoiceLineItems, vehicleNumber, distance, transportMode } = request;

  // Validate invoice amount for E-Way Bill requirement
  const invoiceValue = invoice.totalInvoicePaise / 100;
  const isInterState = invoice.supplyType === "INTER_STATE";

  // E-Way Bill required if inter-state >₹50,000 or intra-state >₹50,000 (state-dependent)
  // For now, we check inter-state requirement
  if (!isInterState && invoiceValue <= 50000) {
    return {
      success: false,
      error: "E-Way Bill not required for intra-state invoices ≤₹50,000",
      errorCode: "NOT_REQUIRED",
    };
  }

  // Validate required fields
  if (!vehicleNumber) {
    return {
      success: false,
      error: "Vehicle number is required",
      errorCode: "MISSING_VEHICLE_NUMBER",
    };
  }

  if (!distance || distance <= 0) {
    return {
      success: false,
      error: "Distance must be greater than 0",
      errorCode: "INVALID_DISTANCE",
    };
  }

  const EWB_API_BASE = process.env.EWAYBILL_API_BASE || "https://ewaybillgst.gov.in";
  const EWB_USERNAME = process.env.EWAYBILL_USERNAME;
  const EWB_PASSWORD = process.env.EWAYBILL_PASSWORD;
  const EWB_GSTIN = process.env.EWAYBILL_GSTIN;

  if (!EWB_USERNAME || !EWB_PASSWORD || !EWB_GSTIN) {
    // Return mock response for development/testing
    console.warn("E-Way Bill credentials not configured. Returning mock EWB number.");
    const mockEwbNo = `MOCK-EWB-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const validUpto = new Date();
    validUpto.setDate(validUpto.getDate() + 1); // Valid for 1 day (inter-state) or till expiry (intra-state)
    
    return {
      success: true,
      ewbNo: mockEwbNo,
      validUpto: validUpto,
    };
  }

  try {
    // Step 1: Authenticate with E-Way Bill portal
    const authResponse = await fetch(`${EWB_API_BASE}/api/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: EWB_USERNAME,
        password: EWB_PASSWORD,
        gstin: EWB_GSTIN,
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

    // Step 2: Build E-Way Bill payload
    const ewbPayload = {
      userGstin: EWB_GSTIN,
      supplyType: invoice.supplyType === "INTER_STATE" ? "O" : "I", // O=Outward (Inter), I=Inward (Intra)
      subSupplyType: "1", // 1=Supply, 2=Import, etc.
      docType: "INV",
      docNo: invoice.invoiceNumber,
      docDate: new Date(invoice.invoiceDate).toISOString().split("T")[0].split("-").reverse().join("/"), // DD/MM/YYYY
      fromGstin: invoice.sellerGstin?.gstin || EWB_GSTIN,
      fromTrdName: invoice.sellerOrg?.legalName || "",
      fromAddr1: invoice.sellerOrg?.addressLine1 || "",
      fromAddr2: invoice.sellerOrg?.addressLine2 || "",
      fromPlace: invoice.sellerOrg?.city || "",
      fromPincode: invoice.sellerOrg?.pincode || "",
      fromStateCode: invoice.sellerOrg?.stateCode || "",
      actFromStateCode: invoice.sellerOrg?.stateCode || "",
      toGstin: invoice.buyerGstin || "",
      toTrdName: invoice.buyerName || "",
      toAddr1: invoice.buyerAddress || "",
      toAddr2: "",
      toPlace: invoice.buyerCity || "",
      toPincode: invoice.buyerPincode || "",
      toStateCode: invoice.customer?.stateCode || invoice.placeOfSupplyStateCode || "",
      actToStateCode: invoice.customer?.stateCode || invoice.placeOfSupplyStateCode || "",
      transactionType: invoice.invoiceType === "B2B" ? "1" : "2", // 1=B2B, 2=B2C
      distance: distance.toString(),
      transporterName: request.transporterName || "",
      transporterId: request.transporterGstin || "",
      vehicleNo: vehicleNumber,
      transMode: transportMode.charAt(0) + transportMode.slice(1).toLowerCase(), // Road, Rail, Air, Ship
      transDocNo: request.transporterDocNo || "",
      transDocDate: request.transporterDocDate
        ? new Date(request.transporterDocDate).toISOString().split("T")[0].split("-").reverse().join("/")
        : "",
      itemList: invoiceLineItems.map((item: any, idx: number) => ({
        itemNo: (idx + 1).toString(),
        productName: item.productName,
        productDesc: item.productName,
        hsnCode: item.hsnCode || "3004",
        quantity: item.quantity.toString(),
        qtyUnit: "PCS",
        cgstRate: invoice.supplyType === "INTRA_STATE" ? (item.gstRate || 0).toString() : "0",
        sgstRate: invoice.supplyType === "INTRA_STATE" ? (item.gstRate || 0).toString() : "0",
        igstRate: invoice.supplyType === "INTER_STATE" ? (item.gstRate || 0).toString() : "0",
        taxableAmount: (item.taxablePaise / 100).toString(),
      })),
      totalValue: (invoice.totalInvoicePaise / 100).toString(),
      cgstValue: invoice.supplyType === "INTRA_STATE" ? (invoice.totalCGSTPaise / 100).toString() : "0",
      sgstValue: invoice.supplyType === "INTRA_STATE" ? (invoice.totalSGSTPaise / 100).toString() : "0",
      igstValue: invoice.supplyType === "INTER_STATE" ? (invoice.totalIGSTPaise / 100).toString() : "0",
      cessValue: "0",
      cessNonAdvolValue: "0",
    };

    // Step 3: Generate E-Way Bill
    const ewbResponse = await fetch(`${EWB_API_BASE}/api/ewaybill/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(ewbPayload),
    });

    if (!ewbResponse.ok) {
      const errorData = await ewbResponse.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || "E-Way Bill generation failed",
        errorCode: errorData.errorCode || "EWB_GENERATION_FAILED",
      };
    }

    const ewbData = await ewbResponse.json();

    // Calculate validity: Inter-state = 1 day, Intra-state = till expiry or 1 day
    const validUpto = new Date();
    if (invoice.supplyType === "INTER_STATE") {
      validUpto.setDate(validUpto.getDate() + 1);
    } else {
      // Intra-state: Valid for 1 day or till expiry, whichever is earlier
      const expiryDate = invoiceLineItems
        .map((item: any) => item.expiryDate ? new Date(item.expiryDate) : null)
        .filter(Boolean)
        .sort((a: Date, b: Date) => a.getTime() - b.getTime())[0];
      
      if (expiryDate && expiryDate.getTime() < validUpto.getTime() + 24 * 60 * 60 * 1000) {
        validUpto.setTime(expiryDate.getTime());
      } else {
        validUpto.setDate(validUpto.getDate() + 1);
      }
    }

    return {
      success: true,
      ewbNo: ewbData.ewbNo || ewbData.EwbNo,
      validUpto: ewbData.validUpto ? new Date(ewbData.validUpto) : validUpto,
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
 * Cancel E-Way Bill
 */
export async function cancelEWayBill(
  request: EWayBillCancelRequest
): Promise<EWayBillCancelResponse> {
  const { ewbNo, cancelReason, remark } = request;

  const EWB_API_BASE = process.env.EWAYBILL_API_BASE || "https://ewaybillgst.gov.in";
  const EWB_USERNAME = process.env.EWAYBILL_USERNAME;
  const EWB_PASSWORD = process.env.EWAYBILL_PASSWORD;

  if (!EWB_USERNAME || !EWB_PASSWORD) {
    console.warn("E-Way Bill credentials not configured. Returning mock cancel.");
    return {
      success: true,
      cancelDate: new Date(),
    };
  }

  try {
    // Authenticate
    const authResponse = await fetch(`${EWB_API_BASE}/api/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: EWB_USERNAME,
        password: EWB_PASSWORD,
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

    // Cancel E-Way Bill
    const cancelResponse = await fetch(`${EWB_API_BASE}/api/ewaybill/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ewbNo: ewbNo,
        cancelRsnCode: cancelReason.toString(),
        remark: remark,
      }),
    });

    if (!cancelResponse.ok) {
      const errorData = await cancelResponse.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || "E-Way Bill cancellation failed",
        errorCode: errorData.errorCode || "CANCEL_FAILED",
      };
    }

    const cancelData = await cancelResponse.json();

    return {
      success: true,
      cancelDate: cancelData.cancelDate ? new Date(cancelData.cancelDate) : new Date(),
    };
  } catch (error: any) {
    console.error("E-Way Bill cancellation error:", error);
    return {
      success: false,
      error: error.message || "Unknown error occurred",
      errorCode: "API_ERROR",
    };
  }
}
