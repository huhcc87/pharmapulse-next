// Delivery Fee Calculation
// Distance-based or fixed delivery charges

export interface DeliveryFeeInput {
  distanceKm?: number; // Distance in kilometers
  orderValuePaise: number; // Order value in paise
  deliveryType?: "STANDARD" | "EXPRESS" | "SAME_DAY";
  pincode?: string; // For zone-based pricing
}

export interface DeliveryFeeResult {
  deliveryFeePaise: number;
  estimatedDays: number;
  deliveryType: string;
}

/**
 * Calculate delivery fee
 * 
 * Rules:
 * - Fixed fee: ₹50 for standard delivery
 * - Distance-based: ₹50 + ₹5/km for distances >5km
 * - Free delivery: Orders >₹500
 * - Express delivery: ₹100
 * - Same-day delivery: ₹150
 */
export function calculateDeliveryFee(input: DeliveryFeeInput): DeliveryFeeResult {
  const { distanceKm, orderValuePaise, deliveryType = "STANDARD", pincode } = input;
  const orderValueRupees = orderValuePaise / 100;

  // Free delivery for orders >₹500
  if (orderValueRupees >= 500) {
    return {
      deliveryFeePaise: 0,
      estimatedDays: deliveryType === "SAME_DAY" ? 0 : deliveryType === "EXPRESS" ? 1 : 2,
      deliveryType,
    };
  }

  let deliveryFeePaise = 0;
  let estimatedDays = 2;

  if (deliveryType === "SAME_DAY") {
    deliveryFeePaise = 15000; // ₹150
    estimatedDays = 0;
  } else if (deliveryType === "EXPRESS") {
    deliveryFeePaise = 10000; // ₹100
    estimatedDays = 1;
  } else {
    // Standard delivery
    if (distanceKm && distanceKm > 5) {
      // Distance-based: ₹50 base + ₹5/km for distances >5km
      deliveryFeePaise = 5000 + (distanceKm - 5) * 500; // ₹50 + ₹5/km
    } else {
      // Fixed fee for distances <=5km
      deliveryFeePaise = 5000; // ₹50
    }
    estimatedDays = 2;
  }

  return {
    deliveryFeePaise,
    estimatedDays,
    deliveryType,
  };
}

/**
 * Get delivery partner estimate
 */
export function getDeliveryPartnerEstimate(
  distanceKm: number,
  orderValuePaise: number
): {
  partner: string;
  feePaise: number;
  estimatedDays: number;
}[] {
  const estimates = [];

  // ShipRocket estimate
  estimates.push({
    partner: "ShipRocket",
    feePaise: calculateDeliveryFee({ distanceKm, orderValuePaise }).deliveryFeePaise,
    estimatedDays: 2,
  });

  // Delhivery estimate
  estimates.push({
    partner: "Delhivery",
    feePaise: calculateDeliveryFee({ distanceKm, orderValuePaise, deliveryType: "STANDARD" }).deliveryFeePaise,
    estimatedDays: 3,
  });

  return estimates;
}
