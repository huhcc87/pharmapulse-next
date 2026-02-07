"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface ScanToInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  drug: {
    id: number;
    brandName: string;
    qrCode: string;
    packSize?: string | null;
    priceInr?: string | null;
    dpcoCeilingPriceInr?: number | null;
  };
  onAdd: (data: {
    drugLibraryId: number;
    qtyOnHand: number;
    purchasePrice?: number;
    sellingPrice?: number;
    batchCode?: string;
    expiryDate?: string;
  }) => Promise<void>;
}

export default function ScanToInventoryModal({
  isOpen,
  onClose,
  drug,
  onAdd,
}: ScanToInventoryModalProps) {
  const [qtyOnHand, setQtyOnHand] = useState(0);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Parse default prices
  let defaultSellingPrice = 0;
  if (drug.dpcoCeilingPriceInr && typeof drug.dpcoCeilingPriceInr === 'number') {
    defaultSellingPrice = drug.dpcoCeilingPriceInr;
  } else if (drug.priceInr) {
    const priceStr = String(drug.priceInr).replace(/[^\d.]/g, '');
    const priceNum = parseFloat(priceStr);
    if (!isNaN(priceNum) && priceNum > 0) {
      defaultSellingPrice = priceNum;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await onAdd({
        drugLibraryId: drug.id,
        qtyOnHand,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
        sellingPrice: sellingPrice ? parseFloat(sellingPrice) : defaultSellingPrice,
        batchCode: batchCode || undefined,
        expiryDate: expiryDate || undefined,
      });
      onClose();
      // Reset form
      setQtyOnHand(0);
      setPurchasePrice("");
      setSellingPrice("");
      setBatchCode("");
      setExpiryDate("");
    } catch (err: any) {
      setError(err?.message || "Failed to add to inventory");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Add to Inventory</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded">
          <div className="font-medium">{drug.brandName}</div>
          <div className="text-sm text-gray-500">QR: {drug.qrCode}</div>
          {drug.packSize && (
            <div className="text-sm text-gray-500">Pack: {drug.packSize}</div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Quantity on Hand *
            </label>
            <input
              type="number"
              min="0"
              required
              value={qtyOnHand}
              onChange={(e) => setQtyOnHand(parseInt(e.target.value) || 0)}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Purchase Price (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Selling Price (₹) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={sellingPrice || defaultSellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Batch Code
            </label>
            <input
              type="text"
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Expiry Date
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full border rounded-md px-3 py-2"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border rounded-md px-4 py-2 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-teal-600 text-white rounded-md px-4 py-2 hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add to Inventory"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

