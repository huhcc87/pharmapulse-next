'use client';

import { useState } from 'react';
import { Search, X, Package, Plus, Loader2, AlertCircle, QrCode } from 'lucide-react';

interface DrugDetails {
  id: number;
  brandName: string;
  manufacturer: string | null;
  priceInr: number | null;
  isDiscontinued: boolean;
  category: string | null;
  packSize: string | null;
  fullComposition: string | null;
  salts: string | null;
  qrCode: string;
}

interface ScanQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToInventory: (drugId: number, qtyOnHand: number) => void;
}

export default function ScanQRModal({ isOpen, onClose, onAddToInventory }: ScanQRModalProps) {
  const [qrInput, setQrInput] = useState('');
  const [drug, setDrug] = useState<DrugDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qtyOnHand, setQtyOnHand] = useState(0);
  const [isAdding, setIsAdding] = useState(false);

  const handleLookup = async () => {
    if (!qrInput.trim()) {
      setError('Please enter a QR code');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDrug(null);

    try {
      const response = await fetch(`/api/drug-library/by-qr?code=${encodeURIComponent(qrInput)}`);
      const data = await response.json();

      if (!response.ok) {
        // Get detailed error message
        const errorMsg = data.error || data.details || 'Failed to lookup drug';
        throw new Error(errorMsg);
      }

      // Handle both response formats
      if ((data.success && data.drug) || (data.found && data.drug)) {
        setDrug(data.drug);
        setError(null);
      } else {
        throw new Error(data.error || 'Drug not found');
      }
    } catch (error: any) {
      console.error('Error looking up QR code:', error);
      // Show user-friendly error message
      const errorMsg = error.message || 'Failed to lookup drug. Please check the QR code format (INMED-000001).';
      setError(errorMsg);
      setDrug(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToInventory = async () => {
    if (!drug) return;
    if (qtyOnHand < 0) {
      setError('Quantity must be 0 or greater');
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      const response = await fetch('/api/inventory/add-from-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: drug.qrCode,
          qtyOnHand,
          tenantId: 1, // TODO: Get from session
          branchId: 1, // TODO: Get from session
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add to inventory');
      }

      // Success
      onAddToInventory(drug.id, qtyOnHand);
      onClose();
      
      // Show success message
      const successMsg = document.createElement('div');
      successMsg.className = 'fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      successMsg.innerHTML = `✓ ${drug.brandName} added to inventory!`;
      document.body.appendChild(successMsg);
      setTimeout(() => successMsg.remove(), 3000);
    } catch (error: any) {
      console.error('Error adding to inventory:', error);
      setError(error.message || 'Failed to add to inventory');
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setQrInput('');
    setDrug(null);
    setError(null);
    setQtyOnHand(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <QrCode className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Scan QR Code</h2>
              <p className="text-sm text-gray-500">Search and add drugs from Drug Library</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* QR Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter QR Code (INMED-xxxxxx) or paste full QR content
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleLookup();
                  }
                }}
                placeholder="INMED-000001 or paste QR content..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                autoFocus
              />
              <button
                onClick={handleLookup}
                disabled={isLoading || !qrInput.trim()}
                className="px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Lookup
                  </>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Format: INMED-000001 to INMED-253973
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Drug Details */}
          {drug && (
            <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{drug.brandName}</h3>
                  {drug.isDiscontinued && (
                    <span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded text-xs mb-2">
                      Discontinued
                    </span>
                  )}
                  {drug.category && (
                    <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs ml-2">
                      {drug.category}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 mb-1">QR Code</div>
                  <div className="font-mono text-sm font-semibold text-gray-900">{drug.qrCode}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                {drug.manufacturer && (
                  <div>
                    <span className="text-gray-600">Manufacturer:</span>
                    <span className="ml-2 font-medium">{drug.manufacturer}</span>
                  </div>
                )}
                {drug.salts && (
                  <div>
                    <span className="text-gray-600">Salts:</span>
                    <span className="ml-2 font-medium">{drug.salts}</span>
                  </div>
                )}
                {drug.packSize && (
                  <div>
                    <span className="text-gray-600">Pack Size:</span>
                    <span className="ml-2 font-medium">{drug.packSize}</span>
                  </div>
                )}
                {drug.priceInr && (
                  <div>
                    <span className="text-gray-600">Price:</span>
                    <span className="ml-2 font-medium">₹{drug.priceInr.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {drug.fullComposition && (
                <div className="mb-4 text-sm">
                  <span className="text-gray-600">Composition:</span>
                  <span className="ml-2">{drug.fullComposition}</span>
                </div>
              )}

              {!drug.isDiscontinued && (
                <div className="border-t border-gray-200 pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity to Add
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      value={qtyOnHand}
                      onChange={(e) => setQtyOnHand(parseInt(e.target.value) || 0)}
                      min="0"
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button
                      onClick={handleAddToInventory}
                      disabled={isAdding || qtyOnHand < 0}
                      className="flex-1 px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isAdding ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Add to Inventory
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

