// src/components/pos/PaymentModal.tsx
"use client";

import { useState } from "react";
import { X, QrCode, CreditCard, Wallet, Banknote, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { PaymentMethod, PaymentRequest, UpiQrResponse } from "@/lib/types/pos";

interface PaymentModalProps {
  isOpen: boolean;
  totalPaise: number;
  onClose: () => void;
  onConfirm: (payments: PaymentRequest[]) => void;
}

export default function PaymentModal({
  isOpen,
  totalPaise,
  onClose,
  onConfirm,
}: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("CASH");
  const [splitPayments, setSplitPayments] = useState<Array<{ method: PaymentMethod; amountPaise: number }>>([]);
  const [splitAmountInput, setSplitAmountInput] = useState<string>("");
  const [upiQr, setUpiQr] = useState<UpiQrResponse | null>(null);
  const [upiVpa, setUpiVpa] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [walletProvider, setWalletProvider] = useState("");
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  if (!isOpen) return null;

  const totalAmount = totalPaise / 100;
  const splitTotal = splitPayments.reduce((sum, p) => sum + p.amountPaise, 0);
  const remaining = totalPaise - splitTotal;

  const handleAddSplit = () => {
    if (!selectedMethod) return;
    
    // Parse the split amount input, or use remaining if empty
    let amountToAdd = remaining;
    if (splitAmountInput.trim()) {
      const inputAmount = parseFloat(splitAmountInput);
      if (!isNaN(inputAmount) && inputAmount > 0) {
        amountToAdd = Math.round(inputAmount * 100); // Convert to paise
        // Ensure it doesn't exceed remaining
        amountToAdd = Math.min(amountToAdd, remaining);
      }
    }
    
    if (amountToAdd > 0 && amountToAdd <= remaining) {
      setSplitPayments([...splitPayments, { method: selectedMethod, amountPaise: amountToAdd }]);
      setSplitAmountInput(""); // Clear input after adding
    }
  };

  const handleUpdateSplitAmount = (index: number, newAmountPaise: number) => {
    const updated = [...splitPayments];
    updated[index].amountPaise = newAmountPaise;
    setSplitPayments(updated);
  };

  const handleRemoveSplit = (index: number) => {
    setSplitPayments(splitPayments.filter((_, i) => i !== index));
  };

  const handleGenerateUPI = async () => {
    try {
      // For demo, create a mock invoice ID
      const res = await fetch("/api/payments/upi/create-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: 0, // Will be updated after invoice creation
          amountPaise: remaining > 0 ? remaining : totalPaise,
          upiVpa: upiVpa || undefined,
          upiProvider: "OTHER",
        }),
      });

      const data = await res.json();
      if (data.qrPayload) {
        setUpiQr(data);
      }
    } catch (error) {
      console.error("UPI QR generation error:", error);
    }
  };

  const handleMarkPaid = async (paymentId: number) => {
    setIsMarkingPaid(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      });

      if (res.ok) {
        // Close modal and proceed
        const payments: PaymentRequest[] = splitPayments.length > 0
          ? splitPayments.map((p) => ({
              method: p.method,
              amountPaise: p.amountPaise,
            }))
          : [{
              method: selectedMethod,
              amountPaise: totalPaise,
              upiVpa: upiVpa || undefined,
              cardLast4: cardLast4 || undefined,
              walletProvider: walletProvider || undefined,
            }];

        onConfirm(payments);
      }
    } catch (error) {
      console.error("Mark paid error:", error);
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const handleRazorpayPayment = async () => {
    if (selectedMethod !== "RAZORPAY") return;

    setIsProcessingRazorpay(true);
    try {
      // Create Razorpay order
      const res = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountPaise: remaining > 0 ? remaining : totalPaise,
          description: `Invoice payment - ₹${((remaining > 0 ? remaining : totalPaise) / 100).toFixed(2)}`,
        }),
      });

      const data = await res.json();

      if (!data.success || !data.orderId) {
        throw new Error(data.error || "Failed to create payment order");
      }

      // Open Razorpay checkout
      const { openRazorpayCheckout } = await import("@/lib/razorpay/checkout");

      await openRazorpayCheckout({
        key: data.key,
        amount: data.amount,
        currency: data.currency || "INR",
        name: "PharmaPulse",
        description: `Payment for Invoice`,
        order_id: data.orderId,
        handler: async (response) => {
          // Payment successful - add to split payments or confirm
          const razorpayPayment: PaymentRequest = {
            method: "RAZORPAY",
            amountPaise: remaining > 0 ? remaining : totalPaise,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          };

          if (splitPayments.length > 0) {
            // Add to split payments
            setSplitPayments([...splitPayments, razorpayPayment]);
            setIsProcessingRazorpay(false);
          } else {
            // Direct confirm
            onConfirm([razorpayPayment]);
          }
        },
        modal: {
          ondismiss: () => {
            setIsProcessingRazorpay(false);
          },
        },
      });
    } catch (error: any) {
      console.error("Razorpay payment error:", error);
      alert(`Payment failed: ${error.message || "Unknown error"}`);
      setIsProcessingRazorpay(false);
    }
  };

  const handleConfirm = () => {
    const payments: PaymentRequest[] = splitPayments.length > 0
      ? splitPayments.map((p) => ({
          method: p.method,
          amountPaise: p.amountPaise,
          upiVpa: p.method === "UPI" ? (p as any).upiVpa : undefined,
          cardLast4: p.method === "CARD" ? (p as any).cardLast4 : undefined,
          walletProvider: p.method === "WALLET" ? (p as any).walletProvider : undefined,
          razorpayOrderId: p.method === "RAZORPAY" ? (p as any).razorpayOrderId : undefined,
          razorpayPaymentId: p.method === "RAZORPAY" ? (p as any).razorpayPaymentId : undefined,
          razorpaySignature: p.method === "RAZORPAY" ? (p as any).razorpaySignature : undefined,
        }))
      : [{
          method: selectedMethod,
          amountPaise: totalPaise,
          upiVpa: selectedMethod === "UPI" ? (upiVpa || undefined) : undefined,
          cardLast4: selectedMethod === "CARD" ? (cardLast4 || undefined) : undefined,
          walletProvider: selectedMethod === "WALLET" ? (walletProvider || undefined) : undefined,
        }];

    onConfirm(payments);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Total Amount */}
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">Total Amount</div>
            <div className="text-3xl font-bold text-gray-900">₹{totalAmount.toFixed(2)}</div>
          </div>

          {/* Payment Methods */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: "CASH", icon: Banknote, label: "Cash" },
                { value: "UPI", icon: QrCode, label: "UPI" },
                { value: "CARD", icon: CreditCard, label: "Card" },
                { value: "WALLET", icon: Wallet, label: "Wallet" },
                { value: "RAZORPAY", icon: CreditCard, label: "Razorpay (Online)" },
                { value: "CREDIT", icon: Smartphone, label: "Credit" },
              ].map((method) => (
                <button
                  key={method.value}
                  onClick={() => setSelectedMethod(method.value as PaymentMethod)}
                  className={`flex items-center gap-2 p-3 border-2 rounded-lg transition-colors ${
                    selectedMethod === method.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <method.icon className="w-5 h-5" />
                  <span className="font-medium">{method.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* UPI QR Code */}
          {selectedMethod === "UPI" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  UPI VPA (Optional)
                </label>
                <input
                  type="text"
                  value={upiVpa}
                  onChange={(e) => setUpiVpa(e.target.value)}
                  placeholder="yourstore@upi"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              {upiQr ? (
                <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
                  <QRCodeSVG value={upiQr.qrPayload} size={200} />
                  <p className="mt-4 text-sm text-gray-600 text-center">
                    Scan with any UPI app
                  </p>
                  <button
                    onClick={() => handleMarkPaid(upiQr.paymentId)}
                    disabled={isMarkingPaid}
                    className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {isMarkingPaid ? "Processing..." : "Mark as Paid"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGenerateUPI}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Generate UPI QR Code
                </button>
              )}
            </div>
          )}

          {/* Card Details */}
          {selectedMethod === "CARD" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last 4 Digits (Optional)
              </label>
              <input
                type="text"
                value={cardLast4}
                onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="1234"
                maxLength={4}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          )}

          {/* Wallet */}
          {selectedMethod === "WALLET" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wallet Provider
              </label>
              <select
                value={walletProvider}
                onChange={(e) => setWalletProvider(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select wallet</option>
                <option value="Paytm">Paytm</option>
                <option value="PhonePe">PhonePe</option>
                <option value="Amazon Pay">Amazon Pay</option>
                <option value="Other">Other</option>
              </select>
            </div>
          )}

          {/* Razorpay Payment */}
          {selectedMethod === "RAZORPAY" && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-700 mb-3">
                  Pay online via Razorpay. Supports UPI, Cards, Netbanking, and Wallets.
                </p>
                <button
                  onClick={handleRazorpayPayment}
                  disabled={isProcessingRazorpay || remaining <= 0}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isProcessingRazorpay ? "Processing..." : `Pay ₹${((remaining > 0 ? remaining : totalPaise) / 100).toFixed(2)} via Razorpay`}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Razorpay supports all major payment methods including UPI, Credit/Debit Cards, Netbanking, and Wallets.
              </p>
            </div>
          )}

          {/* Split Payment */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">Split Payment</label>
              {remaining > 0 && (
                <button
                  onClick={handleAddSplit}
                  disabled={remaining <= 0 || !selectedMethod}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  + Add Another
                </button>
              )}
            </div>

            {/* Split Amount Input (shown when remaining > 0) */}
            {remaining > 0 && (
              <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Amount for {selectedMethod} (Remaining: ₹{(remaining / 100).toFixed(2)})
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={splitAmountInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0)) {
                        setSplitAmountInput(val);
                      }
                    }}
                    placeholder={`₹${(remaining / 100).toFixed(2)} (full remaining)`}
                    min="0"
                    max={(remaining / 100).toFixed(2)}
                    step="0.01"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={handleAddSplit}
                    disabled={!selectedMethod || remaining <= 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to add full remaining amount, or enter a partial amount
                </p>
              </div>
            )}

            {/* Existing Split Payments */}
            {splitPayments.length > 0 && (
              <div className="space-y-2 mb-2">
                {splitPayments.map((payment, idx) => {
                  const isEditable = remaining > 0 || splitTotal < totalPaise;
                  return (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                      <span className="flex-1 text-sm font-medium">
                        {payment.method}: ₹{(payment.amountPaise / 100).toFixed(2)}
                      </span>
                      {isEditable && (
                        <input
                          type="number"
                          value={(payment.amountPaise / 100).toFixed(2)}
                          onChange={(e) => {
                            const newAmount = parseFloat(e.target.value);
                            if (!isNaN(newAmount) && newAmount > 0) {
                              const newAmountPaise = Math.round(newAmount * 100);
                              // Ensure total doesn't exceed totalPaise
                              const otherTotal = splitPayments.reduce((sum, p, i) => 
                                i !== idx ? sum + p.amountPaise : sum, 0
                              );
                              const maxAllowed = totalPaise - otherTotal;
                              handleUpdateSplitAmount(idx, Math.min(newAmountPaise, maxAllowed));
                            }
                          }}
                          min="0.01"
                          max={(totalPaise / 100).toFixed(2)}
                          step="0.01"
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      )}
                      <button
                        onClick={() => handleRemoveSplit(idx)}
                        className="text-red-600 hover:text-red-700 p-1"
                        title="Remove this payment"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Initial Split Payment Button (when no splits exist) */}
            {splitPayments.length === 0 && (
              <button
                onClick={handleAddSplit}
                disabled={remaining <= 0 || !selectedMethod}
                className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                + Start Split Payment (Add ₹{totalAmount.toFixed(2)} as {selectedMethod})
              </button>
            )}

            {/* Split Total Summary */}
            {splitTotal > 0 && (
              <div className={`mt-3 p-2 rounded-lg text-sm font-medium ${
                remaining === 0 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : remaining > 0 
                    ? 'bg-orange-50 text-orange-700 border border-orange-200' 
                    : 'bg-gray-50 text-gray-600'
              }`}>
                <div className="flex justify-between items-center">
                  <span>Split Total:</span>
                  <span className="font-bold">
                    ₹{(splitTotal / 100).toFixed(2)} / ₹{totalAmount.toFixed(2)}
                  </span>
                </div>
                {remaining > 0 && (
                  <div className="text-xs mt-1">
                    Remaining: ₹{(remaining / 100).toFixed(2)} - Add another payment method to complete
                  </div>
                )}
                {remaining < 0 && (
                  <div className="text-xs mt-1 text-red-600">
                    Overpaid by ₹{Math.abs(remaining / 100).toFixed(2)} - Please adjust amounts
                  </div>
                )}
                {remaining === 0 && (
                  <div className="text-xs mt-1">
                    ✓ Payment fully allocated - Ready to confirm
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Confirm Button */}
          <button
            onClick={handleConfirm}
            disabled={splitPayments.length > 0 && remaining > 0}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {selectedMethod === "CASH" ? "Confirm Cash Payment" : "Proceed to Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}


