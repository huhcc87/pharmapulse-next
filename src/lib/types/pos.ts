// src/lib/types/pos.ts
// Shared TypeScript types for POS Terminal (India-first)

export type PaymentMethod = "CASH" | "CARD" | "UPI" | "WALLET" | "CHEQUE" | "BANK_TRANSFER" | "CREDIT" | "RAZORPAY" | "SPLIT";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
export type UpiProvider = "PHONEPE" | "GPAY" | "PAYTM" | "BHIM" | "OTHER";

export interface CustomerDTO {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  dob: string | null; // ISO date string
  allergies: string[] | null;
  notes: string | null;
  gstin: string | null;
  stateCode: string | null;
  loyaltyPoints?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerResponse {
  ok: true;
  customer: {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    createdAt: string;
    loyaltyPoints?: number;
    allergies?: string[];
  };
}

export interface CreateCustomerErrorResponse {
  ok: false;
  error: string;
}

export interface PaymentDTO {
  id: number;
  invoiceId: number;
  method: PaymentMethod;
  amountPaise: number;
  status: PaymentStatus;
  cardLast4?: string | null;
  cardType?: string | null;
  cardTxnRef?: string | null;
  upiTxnId?: string | null;
  upiVpa?: string | null;
  upiProvider?: UpiProvider | null;
  upiQrPayload?: string | null;
  upiQrGeneratedAt?: string | null;
  walletProvider?: string | null;
  walletTxnRef?: string | null;
  txnRef?: string | null;
  txnDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceDTO {
  id: number;
  invoiceNumber: string | null;
  invoiceDate: string;
  status: string;
  customerId: number | null;
  customer?: CustomerDTO | null;
  buyerName: string | null;
  buyerPhone: string | null;
  buyerEmail: string | null;
  totalInvoicePaise: number;
  totalTaxablePaise: number;
  totalGstPaise: number;
  paidAmountPaise: number;
  paymentStatus: string | null;
  paymentMethod: string | null;
  lineItems: InvoiceLineItemDTO[];
  payments: PaymentDTO[];
  receiptSentViaSms: boolean;
  receiptSentViaEmail: boolean;
}

export interface InvoiceLineItemDTO {
  id: number;
  productName: string;
  quantity: number;
  unitPricePaise: number;
  discountPaise: number;
  discountPercent: number | null;
  taxablePaise: number;
  gstRateBps: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  batchNumber: string | null;
  expiryDate: string | null;
  batchId: number | null;
  productId: number | null;
  drugLibraryId: number | null;
}

export interface CartItemWithInventory extends CartItem {
  productId?: number | null;
  drugLibraryId?: number | null;
  availableQty?: number;
  batches?: BatchInfo[];
  isLowStock?: boolean;
  isNearExpiry?: boolean;
}

export interface CartItem {
  key: string;
  productName: string;
  unitPricePaise: number;
  quantity: number;
  unitType?: string;
  hsnCode?: string | null;
  gstRateBps?: number | null;
  discountPaise?: number;
  discountPercent?: number;
  batchNumber?: string | null;
  expiryDate?: string | null;
  productId?: number | string | null;
  drugLibraryId?: number | string | null;
  batchId?: number | null;
}

export interface BatchInfo {
  id: number;
  batchCode: string;
  expiryDate: string;
  quantityOnHand: number;
  daysUntilExpiry: number;
}

export interface CheckoutRequest {
  customerId?: number | null;
  prescriptionId?: number | null;
  lineItems: CartItem[];
  payments: PaymentRequest[];
  discounts?: {
    globalDiscountPaise?: number;
    globalDiscountPercent?: number;
    couponCode?: string;
  };
  sendReceiptSms?: boolean;
  sendReceiptEmail?: boolean;
}

export interface PaymentRequest {
  method: PaymentMethod;
  amountPaise: number;
  upiVpa?: string;
  upiProvider?: UpiProvider;
  cardLast4?: string;
  cardType?: string;
  walletProvider?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  notes?: string;
}

export interface UpiQrResponse {
  qrPayload: string;
  qrImageUrl?: string;
  paymentId: number;
  amountPaise: number;
  expiresAt: string;
}

export interface CheckoutResponse {
  invoice: InvoiceDTO;
  payments: PaymentDTO[];
  loyaltyPointsEarned?: number;
  loyaltyPointsRedeemed?: number;
}

export interface PrescriptionDTO {
  id: number;
  customerId: number;
  customer?: CustomerDTO;
  doctorName: string | null;
  doctorPhone: string | null;
  date: string;
  status: string;
  notes: string | null;
  lines: PrescriptionLineDTO[];
}

export interface PrescriptionLineDTO {
  id: number;
  medicationName: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: number;
  status: string;
  drugLibraryId: number | null;
  productId: number | null;
}

export interface InventoryAlert {
  type: "LOW_STOCK" | "NEAR_EXPIRY" | "EXPIRED";
  productId?: number;
  drugLibraryId?: number;
  productName: string;
  message: string;
  severity: "WARNING" | "ERROR";
  daysUntilExpiry?: number;
  currentStock?: number;
  reorderLevel?: number;
}

export interface DrugInteractionAlert {
  severity: "WARNING" | "ERROR";
  message: string;
  interactingDrugs: string[];
  acknowledged: boolean;
}

export interface SuggestedAddOn {
  productId?: number;
  drugLibraryId?: number;
  productName: string;
  reason: string;
  pricePaise: number;
}

export interface RefillReminder {
  productName: string;
  lastPurchaseDate: string;
  daysSinceLastPurchase: number;
  suggestedQuantity: number;
}

