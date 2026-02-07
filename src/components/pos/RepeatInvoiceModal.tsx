"use client";

import { useState, useEffect } from "react";
import { RotateCcw, X } from "lucide-react";

interface RepeatInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (lineItems: any[], customer: any | null) => void;
}

export default function RepeatInvoiceModal({
  isOpen,
  onClose,
  onConfirm,
}: RepeatInvoiceModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      fetchLastInvoice();
    }
  }, [isOpen]);

  async function fetchLastInvoice() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/pos/repeat-last-invoice");
      if (res.ok) {
        const data = await res.json();
        setLastInvoice(data);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to fetch last invoice");
        onClose();
      }
    } catch (error) {
      console.error("Error fetching last invoice:", error);
      alert("Failed to fetch last invoice");
      onClose();
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Repeat Last Invoice
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading last invoice...</div>
        ) : lastInvoice ? (
          <div>
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <div className="text-sm text-gray-600">
                Invoice: <strong>{lastInvoice.invoice.invoiceNumber}</strong>
              </div>
              <div className="text-sm text-gray-600">
                Date:{" "}
                {new Date(lastInvoice.invoice.invoiceDate).toLocaleDateString()}
              </div>
              {lastInvoice.customer && (
                <div className="text-sm text-gray-600">
                  Customer: <strong>{lastInvoice.customer.name}</strong>
                </div>
              )}
              <div className="text-sm text-gray-600 mt-2">
                Items: <strong>{lastInvoice.lineItems.length}</strong>
              </div>
            </div>
            <p className="mb-4 text-sm text-gray-600">
              Load this invoice into your cart? Stock availability will be
              checked and quantities adjusted if needed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  onConfirm(
                    lastInvoice.lineItems,
                    lastInvoice.customer || null
                  );
                  onClose();
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Load into Cart
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No previous invoice found
          </div>
        )}
      </div>
    </div>
  );
}
