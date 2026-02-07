"use client";

import { useState, useEffect } from "react";
import { Star, Package, TrendingUp } from "lucide-react";

interface Favorite {
  id: number;
  drugLibraryId?: number;
  productId?: number;
  name: string;
  mrp?: number;
  stockLevel?: number;
  isFavorite: boolean;
}

interface FavoritesPanelProps {
  onSelectItem: (item: Favorite) => void;
  onToggleFavorite: (itemId: number, drugLibraryId?: number, productId?: number) => void;
  type: "favorites" | "fast-moving";
}

export default function FavoritesPanel({
  onSelectItem,
  onToggleFavorite,
  type,
}: FavoritesPanelProps) {
  const [items, setItems] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, [type]);

  async function loadItems() {
    setIsLoading(true);
    try {
      const endpoint =
        type === "favorites" ? "/api/pos/favorites" : "/api/pos/fast-moving";
      const res = await fetch(endpoint);
      const data = await res.json();
      setItems(data.items || []);
    } catch (error) {
      console.error("Failed to load items:", error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        {type === "favorites" ? (
          <Star className="w-5 h-5 text-yellow-500" />
        ) : (
          <TrendingUp className="w-5 h-5 text-blue-500" />
        )}
        <h3 className="font-semibold">
          {type === "favorites" ? "Favorites" : "Fast-Moving"}
        </h3>
      </div>
      <div className="space-y-2 max-h-96 overflow-auto">
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            {type === "favorites"
              ? "No favorites yet. Star items to add them here."
              : "No fast-moving items found."}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => onSelectItem(item)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-sm">{item.name}</div>
                  <div className="text-xs text-gray-600 mt-1 flex items-center gap-3">
                    {item.mrp && <span>₹{item.mrp.toFixed(2)}</span>}
                    {item.stockLevel !== undefined && (
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {item.stockLevel}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(
                      item.id,
                      item.drugLibraryId,
                      item.productId
                    );
                  }}
                  className="ml-2 p-1 hover:bg-gray-100 rounded"
                >
                  <Star
                    className={`w-4 h-4 ${
                      item.isFavorite ? "fill-yellow-500 text-yellow-500" : "text-gray-400"
                    }`}
                  />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
