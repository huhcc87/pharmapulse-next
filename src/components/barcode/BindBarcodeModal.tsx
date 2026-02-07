"use client";

import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";

type Product = {
  id: string;
  name: string;
  barcode?: string | null;
  barcodeType?: string | null;
  internalCode?: string | null;
};

interface BindBarcodeModalProps {
  open: boolean;
  barcode: string;
  onClose: () => void;
  onBound: (product: Product) => void;
  onCreateNew?: () => void; // Optional callback for creating new product
}

export default function BindBarcodeModal({
  open,
  barcode,
  onClose,
  onBound,
  onCreateNew,
}: BindBarcodeModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [binding, setBinding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setResults([]);
      setError(null);
      return;
    }

    // Auto-search with the scanned barcode
    if (barcode.trim()) {
      setSearchQuery(barcode);
      searchProducts(barcode);
    }
  }, [open, barcode]);

  async function searchProducts(query: string) {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pos/search?q=${encodeURIComponent(q)}&take=20`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleBind(productId: string) {
    setBinding(productId);
    setError(null);

    try {
      const res = await fetch("/api/products/link-barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          code: barcode.trim(),
          source: "manual",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError("Barcode already assigned to another product");
        } else {
          setError(data.error || "Failed to bind barcode");
        }
        setBinding(null);
        return;
      }

      // Success - call onBound with product data
      onBound(data.product);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to bind barcode");
      setBinding(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">Link Barcode to Product</h2>
            <p className="text-sm text-gray-600">Scanned: {barcode}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              const q = e.target.value;
              setSearchQuery(q);
              searchProducts(q);
            }}
            placeholder="Search products by name or code..."
            className="w-full border rounded-md px-3 py-2"
            autoFocus
          />
          {loading && (
            <div className="mt-2 text-sm text-gray-500">Searching...</div>
          )}
          {error && (
            <div className="mt-2 text-sm text-red-600">{error}</div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {results.length === 0 && !loading && searchQuery.trim().length >= 2 && (
            <div className="text-center text-gray-500 py-8 space-y-4">
              <p>No products found. Try a different search term.</p>
              {onCreateNew && (
                <button
                  onClick={onCreateNew}
                  className="mt-4 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  Create New Product with this Barcode
                </button>
              )}
            </div>
          )}

          <div className="space-y-2">
            {results.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between border rounded-md p-3 hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm text-gray-500">
                    {product.internalCode && `Code: ${product.internalCode}`}
                    {product.barcode && ` • Barcode: ${product.barcode}`}
                  </div>
                </div>
                <button
                  onClick={() => handleBind(product.id)}
                  disabled={binding === product.id}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {binding === product.id ? "Linking..." : "Link"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
