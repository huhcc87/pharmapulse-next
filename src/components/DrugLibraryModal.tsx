'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, X, Package, Plus, Loader2, AlertCircle, Clock } from 'lucide-react';
import { getStockIcon, getExpiryIcon } from '@/lib/inventory/stock-indicators';

interface DrugLibraryResult {
  id: number;
  brandName: string;
  manufacturer: string | null;
  priceInr: string | number | null; // Can be string or number
  isDiscontinued: boolean;
  category: string | null;
  packSize: string | null;
  fullComposition: string | null;
  salts: string | null;
  composition1: string | null;
  composition2: string | null;
  gstPercent: number | null;
  schedule: string | null;
  rxOtc: string | null;
  qrCode?: string;
  qrPayload?: string;
  score?: number;
  matchReason?: string;
  dpcoCeilingPriceInr?: number | null;
  // Inventory indicators
  stockQuantity?: number;
  stockStatus?: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  expiryStatus?: 'SAFE' | 'NEAR' | 'SOON' | 'CRITICAL' | 'EXPIRED' | null;
  daysToExpiry?: number | null;
  needsAttention?: boolean;
  bestBatch?: {
    id: number;
    batchCode: string;
    expiryDate: string;
    daysToExpiry: number;
    quantityOnHand: number;
  } | null;
}

interface DrugLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDrug: (drug: DrugLibraryResult) => void;
  initialSearch?: string;
}

export default function DrugLibraryModal({ 
  isOpen, 
  onClose, 
  onSelectDrug,
  initialSearch = '' 
}: DrugLibraryModalProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [searchResults, setSearchResults] = useState<DrugLibraryResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [totalResults, setTotalResults] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const categories = [
    'all',
    'Tablet',
    'Capsule',
    'Injection',
    'Syrup',
    'Cream',
    'Drops',
    'Suspension',
  ];

  const handleSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setTotalResults(0);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Try new enhanced search endpoint first, fallback to old
      let url = `/api/drugs/search?q=${encodeURIComponent(query)}&limit=50`;
      console.log('🔍 Searching drugs (enhanced):', url);
      
      let response = await fetch(url);
      let data = await response.json();

      // Fallback to old endpoint if new one fails
      if (!response.ok || !data.items) {
        url = `/api/drug-library/search?q=${encodeURIComponent(query)}&limit=50`;
        console.log('🔍 Fallback to drug-library search:', url);
        response = await fetch(url);
        data = await response.json();
      }
      
      console.log('📦 Drug library search response:', { 
        status: response.status, 
        resultsCount: data.results?.length || 0,
        total: data.total 
      });
      
      if (!response.ok) {
        // Get error message from response
        const errorMsg = data.error || data.message || 'Search failed';
        throw new Error(errorMsg);
      }

      if (data.error) {
        // Check if it's an empty database error
        if (data.error.includes("empty") || data.error.includes("import")) {
          setError(`Drug library is empty. ${data.hint || "Please import drug data first."}`);
        } else {
          throw new Error(data.error);
        }
        setSearchResults([]);
        setTotalResults(0);
        return;
      }

      // Handle both old and new API response formats
      let results = data.results || data.items || [];
      
      // Transform enhanced results to match interface
      if (data.items && data.items.length > 0 && data.items[0].stockStatus !== undefined) {
        results = data.items.map((item: any) => ({
          id: item.id,
          drugLibraryId: item.drugLibraryId,
          brandName: item.name,
          manufacturer: item.manufacturer,
          priceInr: item.priceInr || item.mrp,
          isDiscontinued: false,
          category: item.category,
          packSize: null,
          fullComposition: item.salts,
          salts: item.salts,
          composition1: null,
          composition2: null,
          gstPercent: item.gstRate,
          schedule: item.schedule,
          rxOtc: null,
          stockQuantity: item.stockQuantity,
          stockStatus: item.stockStatus,
          expiryStatus: item.expiryStatus,
          daysToExpiry: item.daysToExpiry,
          needsAttention: item.needsAttention,
          bestBatch: item.bestBatch,
          hsnCode: item.hsnCode,
        }));
      }
      
      console.log('✅ Setting search results:', results.length);
      setSearchResults(results);
      setTotalResults(data.total !== undefined ? data.total : results.length);
      
      // Show message if no results found
      if (results.length === 0 && query.length >= 2) {
        setError(`No drugs found for "${query}". Try a different search term.`);
      } else {
        setError(null);
      }
    } catch (error: any) {
      console.error('❌ Error searching drug library:', error);
      setError(error.message || 'Failed to search drug library. Please try again.');
      setSearchResults([]);
      setTotalResults(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && initialSearch) {
      setSearchQuery(initialSearch);
      handleSearch(initialSearch);
    }
  }, [isOpen, initialSearch, handleSearch]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery && searchQuery.length >= 2) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
        setTotalResults(0);
        setError(null);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, handleSearch]);

  const filteredResults = selectedCategory === 'all' 
    ? searchResults 
    : searchResults.filter(drug => drug.category === selectedCategory);

  const handleSelectDrug = (drug: DrugLibraryResult) => {
    if (drug.isDiscontinued) {
      alert('This drug is discontinued and cannot be added to inventory.');
      return;
    }
    onSelectDrug(drug);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">MR Drug Library</h2>
              <p className="text-sm text-gray-500">Search and add drugs from in-house database</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by brand name, salts, composition, or manufacturer..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                autoFocus
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
          {searchQuery && searchQuery.length >= 2 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <span>Found {totalResults} result{totalResults !== 1 ? 's' : ''}</span>
              {totalResults > 50 && (
                <span className="text-orange-600">(Showing first 50)</span>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
              <span className="ml-3 text-gray-600">Searching drug library...</span>
            </div>
          ) : searchQuery && searchQuery.length >= 2 && filteredResults.length > 0 ? (
            <div className="space-y-3">
              {filteredResults.map((drug) => (
                <div
                  key={drug.id}
                  className={`border rounded-lg p-4 hover:border-teal-300 hover:shadow-md transition-all ${
                    drug.isDiscontinued ? 'opacity-60 border-gray-200' : 'border-gray-200 cursor-pointer'
                  }`}
                  onClick={() => !drug.isDiscontinued && handleSelectDrug(drug)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{drug.brandName}</h3>
                        {drug.stockStatus && (
                          <span className="text-lg" title={drug.stockStatus === 'IN_STOCK' ? 'In stock' : drug.stockStatus === 'LOW_STOCK' ? 'Low stock' : 'Out of stock'}>
                            {getStockIcon(drug.stockStatus)}
                          </span>
                        )}
                        {drug.expiryStatus && drug.expiryStatus !== 'SAFE' && (
                          <span className="text-sm" title={`${drug.daysToExpiry} days to expiry`}>
                            {getExpiryIcon(drug.expiryStatus)}
                          </span>
                        )}
                        {drug.isDiscontinued && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                            Discontinued
                          </span>
                        )}
                        {drug.category && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                            {drug.category}
                          </span>
                        )}
                        {drug.schedule && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                            Schedule {drug.schedule}
                          </span>
                        )}
                        {drug.rxOtc && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                            {drug.rxOtc}
                          </span>
                        )}
                        {drug.needsAttention && (
                          <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Attention
                          </span>
                        )}
                      </div>
                      
                      {drug.salts && (
                        <div className="text-sm text-gray-700 mb-2">
                          <span className="font-medium">Salts:</span> {drug.salts}
                        </div>
                      )}
                      
                      {drug.fullComposition && (
                        <div className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Composition:</span> {drug.fullComposition}
                        </div>
                      )}
                      
                      {drug.stockQuantity !== undefined && (
                        <div className="text-xs text-gray-500 mb-2">
                          <span className="font-medium">Stock:</span> <strong className={drug.stockStatus === 'OUT_OF_STOCK' ? 'text-red-600' : drug.stockStatus === 'LOW_STOCK' ? 'text-yellow-600' : 'text-gray-700'}>{drug.stockQuantity}</strong>
                          {drug.bestBatch && drug.daysToExpiry !== null && drug.daysToExpiry !== undefined && (
                            <span className="ml-2">
                              • Expiry: {drug.daysToExpiry > 0 ? `${drug.daysToExpiry} days` : 'Expired'}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        {drug.manufacturer && (
                          <span>Manufacturer: <span className="font-medium">{drug.manufacturer}</span></span>
                        )}
                        {drug.packSize && (
                          <span>Pack: <span className="font-medium">{drug.packSize}</span></span>
                        )}
                        {(drug.priceInr || drug.dpcoCeilingPriceInr) && (
                          <span className="font-semibold text-gray-900">
                            Price: {drug.dpcoCeilingPriceInr 
                              ? `₹${drug.dpcoCeilingPriceInr.toFixed(2)}` 
                              : typeof drug.priceInr === 'string' 
                                ? `₹${drug.priceInr}` 
                                : drug.priceInr 
                                  ? `₹${drug.priceInr.toFixed(2)}` 
                                  : 'N/A'}
                          </span>
                        )}
                        {drug.qrCode && (
                          <span className="font-mono text-xs">QR: {drug.qrCode}</span>
                        )}
                        {drug.gstPercent && (
                          <span>GST: {drug.gstPercent}%</span>
                        )}
                      </div>
                      
                      {drug.matchReason && (
                        <div className="mt-2 text-xs text-gray-400">
                          Match: {drug.matchReason}
                        </div>
                      )}
                    </div>
                    {!drug.isDiscontinued && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectDrug(drug);
                        }}
                        className="ml-4 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 flex items-center gap-2 whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4" />
                        Add to Inventory
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : error && error.includes("empty") ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
                <h3 className="font-semibold text-yellow-900 mb-2">Drug Library is Empty</h3>
                <p className="text-sm text-yellow-800 mb-4">
                  The drug library database is empty. You need to import drug data first.
                </p>
                <div className="bg-yellow-100 rounded p-3 font-mono text-xs text-yellow-900 mb-4">
                  npm run db:import-drug-library
                </div>
                <p className="text-xs text-yellow-700">
                  Place your CSV file in the project root or set DRUG_CSV_PATH environment variable.
                </p>
              </div>
            </div>
          ) : searchQuery && searchQuery.length >= 2 && filteredResults.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No drugs found for "{searchQuery}"</p>
              <p className="text-sm text-gray-500">Try searching by brand name, salt, or manufacturer</p>
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Start typing to search the drug library</p>
              <p className="text-sm text-gray-500">Search by brand name, salts, composition, or manufacturer</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
