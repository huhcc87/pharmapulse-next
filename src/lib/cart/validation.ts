/**
 * Cart Validation for Invoice Preview
 * Validates cart items before allowing checkout
 */

export type ValidationIssue = {
  type: "MISSING_GST" | "MISSING_HSN" | "MISSING_PRODUCT_NAME" | "INVALID_QUANTITY" | "INVALID_PRICE" | "ERROR";
  itemKey?: string;
  productId?: number;
  productName?: string;
  message: string;
  suggestion?: {
    hsnCode: string;
    gstRate: number;
    description?: string;
  };
};

export type NormalizedLineItem = {
  productId?: number;
  productName: string;
  quantity: number;
  unitPricePaise: number;
  gstRate: number; // Always a number 0-100, never null/undefined
  hsnCode: string | null;
  isTaxInclusive: boolean;
  gstType: "INCLUSIVE" | "EXCLUSIVE";
  // Additional fields
  discountPaise?: number;
  discountPercent?: number;
  batchId?: number;
  drugLibraryId?: number;
};

/**
 * Normalize a line item to ensure all required fields exist
 */
export function normalizeLineItem(line: any): NormalizedLineItem | null {
  if (!line) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Line missing GST - line is null/undefined", line);
    }
    return null;
  }

  // Extract GST rate from various possible fields
  let gstRate: number = 12; // Default to 12% for medicines

  // Try to get gstRate from various sources
  if (line.gstRate != null) {
    const parsed = typeof line.gstRate === "string" ? parseFloat(line.gstRate) : Number(line.gstRate);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      gstRate = parsed;
    }
  } else if (line.gstRateBps != null) {
    const parsed = typeof line.gstRateBps === "string" ? parseFloat(line.gstRateBps) : Number(line.gstRateBps);
    if (!isNaN(parsed) && parsed >= 0) {
      gstRate = parsed / 100; // Convert basis points to percentage
    }
  } else if (line.tax_profile?.gst_rate != null) {
    const parsed = typeof line.tax_profile.gst_rate === "string" 
      ? parseFloat(line.tax_profile.gst_rate) 
      : Number(line.tax_profile.gst_rate);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      gstRate = parsed;
    }
  } else if (line.gst_rate != null) {
    const parsed = typeof line.gst_rate === "string" ? parseFloat(line.gst_rate) : Number(line.gst_rate);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      gstRate = parsed;
    }
  }

  // If still no valid GST rate found, log warning
  if (gstRate === 12 && process.env.NODE_ENV === "development") {
    console.warn("Line missing GST - using default 12%", {
      line,
      productName: line.productName,
      productId: line.productId,
    });
  }

  // Extract other fields with safe defaults
  const productName = line.productName || line.name || "Unknown Product";
  const quantity = Math.max(1, Math.floor(Number(line.quantity) || 1));
  const unitPricePaise = Math.max(0, Math.round(Number(line.unitPricePaise) || Number(line.unitPrice) * 100 || 0));
  const hsnCode = line.hsnCode || line.validatedHsnCode || null;
  const gstType = (line.gstType || line.tax_profile?.gst_type || "EXCLUSIVE") as "INCLUSIVE" | "EXCLUSIVE";
  const isTaxInclusive = gstType === "INCLUSIVE";

  return {
    productId: line.productId,
    productName,
    quantity,
    unitPricePaise,
    gstRate, // Always a valid number
    hsnCode,
    isTaxInclusive,
    gstType,
    discountPaise: line.discountPaise,
    discountPercent: line.discountPercent,
    batchId: line.batchId,
    drugLibraryId: line.drugLibraryId,
  };
}

/**
 * Validate cart items for invoice generation
 * Returns array of validation issues
 */
export function validateCartForInvoice(cartItems: any[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    issues.push({
      type: "ERROR",
      message: "Cart is empty",
    });
    return issues;
  }

  for (const item of cartItems) {
    const itemKey = item.key || item.productId || `item-${cartItems.indexOf(item)}`;
    const productId = item.productId;
    const productName = item.productName || item.name || "Unknown Product";

    // 1. Validate product name exists
    if (!item.productName && !item.name) {
      issues.push({
        type: "MISSING_PRODUCT_NAME",
        itemKey,
        productId,
        productName: "Unknown",
        message: `Product name is missing for item ${itemKey}`,
      });
    }

    // 2. Validate quantity > 0
    const quantity = Number(item.quantity) || 0;
    if (quantity <= 0) {
      issues.push({
        type: "INVALID_QUANTITY",
        itemKey,
        productId,
        productName,
        message: `${productName}: Quantity must be greater than 0 (current: ${quantity})`,
      });
    }

    // 3. Validate unit price exists
    const unitPricePaise = item.unitPricePaise || (item.unitPrice ? Math.round(item.unitPrice * 100) : 0);
    if (unitPricePaise <= 0) {
      issues.push({
        type: "INVALID_PRICE",
        itemKey,
        productId,
        productName,
        message: `${productName}: Unit price is missing or invalid`,
      });
    }

    // 4. Validate GST rate exists
    let hasGstRate = false;
    let gstRateValue: number | null = null;

    // Check various possible GST rate fields
    if (item.gstRate != null) {
      const parsed = typeof item.gstRate === "string" ? parseFloat(item.gstRate) : Number(item.gstRate);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        hasGstRate = true;
        gstRateValue = parsed;
      }
    } else if (item.gstRateBps != null) {
      const parsed = typeof item.gstRateBps === "string" ? parseFloat(item.gstRateBps) : Number(item.gstRateBps);
      if (!isNaN(parsed) && parsed >= 0) {
        hasGstRate = true;
        gstRateValue = parsed / 100;
      }
    } else if (item.tax_profile?.gst_rate != null) {
      const parsed = typeof item.tax_profile.gst_rate === "string" 
        ? parseFloat(item.tax_profile.gst_rate) 
        : Number(item.tax_profile.gst_rate);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        hasGstRate = true;
        gstRateValue = parsed;
      }
    } else if (item.gst_rate != null) {
      const parsed = typeof item.gst_rate === "string" ? parseFloat(item.gst_rate) : Number(item.gst_rate);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        hasGstRate = true;
        gstRateValue = parsed;
      }
    }

    if (!hasGstRate) {
      issues.push({
        type: "MISSING_GST",
        itemKey,
        productId,
        productName,
        message: `${productName}: GST rate is missing. Please update the product settings.`,
        suggestion: {
          hsnCode: item.hsnCode || "3004",
          gstRate: 12, // Default suggestion
          description: "Default GST rate for medicines",
        },
      });
    }

    // 5. Validate HSN code (warning, not blocking by default)
    // This can be configured to be blocking if needed
    const hsnCode = item.hsnCode || item.validatedHsnCode;
    if (!hsnCode) {
      issues.push({
        type: "MISSING_HSN",
        itemKey,
        productId,
        productName,
        message: `${productName}: HSN code is missing. Please update the product settings.`,
        suggestion: {
          hsnCode: "3004", // Default for medicines
          gstRate: gstRateValue || 12,
          description: "Default HSN code for medicines",
        },
      });
    }
  }

  if (process.env.NODE_ENV === "development" && issues.length > 0) {
    console.warn("Invoice validation issues:", issues);
  }

  return issues;
}

/**
 * Filter issues by type
 */
export function filterBlockingIssues(issues: ValidationIssue[]): ValidationIssue[] {
  // MISSING_HSN is typically a warning, not blocking
  // But MISSING_GST, INVALID_QUANTITY, INVALID_PRICE are blocking
  return issues.filter(issue => 
    issue.type === "MISSING_GST" || 
    issue.type === "INVALID_QUANTITY" || 
    issue.type === "INVALID_PRICE" ||
    issue.type === "MISSING_PRODUCT_NAME" ||
    issue.type === "ERROR"
  );
}
