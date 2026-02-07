// Cash Memo for Small Sales
// Simplified billing for OTC items < ₹200

export interface CashMemo {
  id?: number;
  memoNumber: string; // CM/YYYY-MM/0001
  date: Date;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number; // in paise
    total: number; // in paise
  }>;
  totalAmount: number; // in paise
  paymentMethod: 'CASH' | 'UPI' | 'CARD';
  customerName?: string;
  customerPhone?: string;
}

/**
 * Generate cash memo number
 */
export function generateCashMemoNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  // Sequence would come from database
  const sequence = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `CM/${year}-${month}/${sequence}`;
}

/**
 * Create cash memo
 */
export function createCashMemo(
  items: CashMemo['items'],
  paymentMethod: CashMemo['paymentMethod'],
  customerName?: string,
  customerPhone?: string
): CashMemo {
  const totalAmount = items.reduce(
    (sum, item) => sum + item.total,
    0
  );

  return {
    memoNumber: generateCashMemoNumber(),
    date: new Date(),
    items,
    totalAmount,
    paymentMethod,
    customerName,
    customerPhone,
  };
}
