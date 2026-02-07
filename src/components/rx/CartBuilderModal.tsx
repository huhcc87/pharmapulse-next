"use client";

import { useState, useEffect } from "react";
import { Search, CheckCircle2, X, AlertCircle, Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ParsedLine {
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  frequency?: string;
  duration?: string;
  quantity?: number;
  instructions?: string;
  confidence: number;
}

interface DrugLibraryResult {
  id: number;
  brandName: string;
  manufacturer?: string;
  salts?: string;
  packSize?: string;
  priceInr?: number;
  isDiscontinued?: boolean;
}

interface CartBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  parsedLines: ParsedLine[];
  onAddToCart: (mappedItems: Array<{
    drugLibraryId: number;
    productName: string;
    quantity: number;
    pricePaise?: number;
  }>) => void;
}

export default function CartBuilderModal({
  isOpen,
  onClose,
  parsedLines,
  onAddToCart,
}: CartBuilderModalProps) {
  const [mappedItems, setMappedItems] = useState<
    Map<number, { drug: DrugLibraryResult | null; quantity: number; confirmed: boolean }>
  >(new Map());
  const [searchQueries, setSearchQueries] = useState<Map<number, string>>(new Map());
  const [searchResults, setSearchResults] = useState<Map<number, DrugLibraryResult[]>>(new Map());
  const [isSearching, setIsSearching] = useState<Map<number, boolean>>(new Map());

  useEffect(() => {
    if (parsedLines.length > 0) {
      // Initialize mappings
      const initial = new Map();
      parsedLines.forEach((line, idx) => {
        initial.set(idx, {
          drug: null,
          quantity: line.quantity || 1,
          confirmed: false,
        });
      });
      setMappedItems(initial);

      // Auto-search for each line
      parsedLines.forEach((line, idx) => {
        if (line.medicationName) {
          searchDrug(idx, line.medicationName);
        }
      });
    }
  }, [parsedLines]);

  const searchDrug = async (lineIndex: number, query: string) => {
    if (!query || query.trim().length < 2) return;

    setIsSearching((prev) => new Map(prev).set(lineIndex, true));
    setSearchQueries((prev) => new Map(prev).set(lineIndex, query));

    try {
      const response = await fetch(
        `/api/drug-library/search?q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();

      const results = Array.isArray(data) ? data : data.results || [];
      setSearchResults((prev) => new Map(prev).set(lineIndex, results));
    } catch (error) {
      console.error("Drug search error:", error);
      setSearchResults((prev) => new Map(prev).set(lineIndex, []));
    } finally {
      setIsSearching((prev) => new Map(prev).set(lineIndex, false));
    }
  };

  const handleSelectDrug = (lineIndex: number, drug: DrugLibraryResult) => {
    setMappedItems((prev) => {
      const updated = new Map(prev);
      const current = updated.get(lineIndex);
      updated.set(lineIndex, {
        drug,
        quantity: current?.quantity || parsedLines[lineIndex].quantity || 1,
        confirmed: true,
      });
      return updated;
    });
  };

  const handleConfirmAll = () => {
    const confirmedItems: any[] = [];
    
    mappedItems.forEach((mapping, idx) => {
      if (mapping.drug && mapping.confirmed) {
        confirmedItems.push({
          drugLibraryId: mapping.drug.id,
          productName: mapping.drug.brandName,
          quantity: mapping.quantity,
          pricePaise: mapping.drug.priceInr
            ? Math.round(parseFloat(String(mapping.drug.priceInr)) * 100)
            : undefined,
        });
      }
    });

    if (confirmedItems.length > 0) {
      onAddToCart(confirmedItems);
      onClose();
    }
  };

  if (!isOpen) return null;

  const allConfirmed = Array.from(mappedItems.values()).every((m) => m.drug && m.confirmed);
  const hasMappings = Array.from(mappedItems.values()).some((m) => m.drug);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex items-center justify-between border-b">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Map Rx Items to Drug Library
          </CardTitle>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {parsedLines.map((line, idx) => {
            const mapping = mappedItems.get(idx);
            const searchResult = searchResults.get(idx) || [];
            const isSearchingLine = isSearching.get(idx) || false;
            const searchQuery = searchQueries.get(idx) || "";

            return (
              <div
                key={idx}
                className={`p-4 rounded-lg border-2 ${
                  mapping?.confirmed
                    ? "border-green-300 bg-green-50"
                    : line.confidence < 0.5
                    ? "border-yellow-300 bg-yellow-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="font-semibold text-lg">{line.medicationName}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {line.strength && `${line.strength} `}
                      {line.dosageForm && `${line.dosageForm} `}
                      {line.frequency && `• ${line.frequency} `}
                      {line.duration && `• ${line.duration}`}
                    </div>
                    {line.confidence < 0.5 && (
                      <Badge variant="outline" className="mt-2 bg-yellow-100 text-yellow-800">
                        Low Confidence - Verify carefully
                      </Badge>
                    )}
                  </div>
                  {mapping?.confirmed && (
                    <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                  )}
                </div>

                {/* Search Input */}
                {!mapping?.confirmed && (
                  <div className="mb-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          const query = e.target.value;
                          setSearchQueries((prev) => new Map(prev).set(idx, query));
                          if (query.length >= 2) {
                            searchDrug(idx, query);
                          }
                        }}
                        placeholder="Search drug library..."
                        className="w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {isSearchingLine && (
                        <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-blue-600" />
                      )}
                    </div>
                  </div>
                )}

                {/* Search Results */}
                {!mapping?.confirmed && searchResult.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {searchResult.map((drug) => (
                      <button
                        key={drug.id}
                        type="button"
                        onClick={() => handleSelectDrug(idx, drug)}
                        className="w-full text-left p-3 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                      >
                        <div className="font-semibold">{drug.brandName}</div>
                        <div className="text-sm text-gray-600">
                          {drug.manufacturer && `${drug.manufacturer} • `}
                          {drug.salts && `${drug.salts} • `}
                          {drug.packSize && `${drug.packSize}`}
                        </div>
                        {drug.priceInr && (
                          <div className="text-sm font-medium text-green-600 mt-1">
                            ₹{parseFloat(String(drug.priceInr)).toFixed(2)}
                          </div>
                        )}
                        {drug.isDiscontinued && (
                          <Badge variant="outline" className="mt-1 bg-red-100 text-red-800">
                            Discontinued
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected Drug */}
                {mapping?.drug && mapping.confirmed && (
                  <div className="p-3 bg-white rounded border border-green-200">
                    <div className="font-semibold">{mapping.drug.brandName}</div>
                    <div className="text-sm text-gray-600">
                      {mapping.drug.manufacturer && `${mapping.drug.manufacturer} • `}
                      Quantity: {mapping.quantity}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setMappedItems((prev) => {
                          const updated = new Map(prev);
                          updated.set(idx, { drug: null, quantity: line.quantity || 1, confirmed: false });
                          return updated;
                        });
                      }}
                      className="mt-2"
                    >
                      Change
                    </Button>
                  </div>
                )}

                {/* No Results */}
                {!mapping?.confirmed &&
                  !isSearchingLine &&
                  searchQuery.length >= 2 &&
                  searchResult.length === 0 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                      <AlertCircle className="w-4 h-4 inline mr-2" />
                      No matches found. Try a different search term or add manually.
                    </div>
                  )}
              </div>
            );
          })}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAll}
              disabled={!allConfirmed || !hasMappings}
              className="flex-1"
            >
              Add {mappedItems.size} Item(s) to Cart
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
