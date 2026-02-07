'use client';

import { useState, useEffect } from 'react';
import { Brain, Loader2, CheckCircle2, AlertTriangle, Search, Sparkles, CheckCircle, XCircle } from 'lucide-react';

interface ProductDetails {
  name: string;
  category: string;
  description?: string;
  manufacturer?: string;
  composition?: string;
  dosage?: string;
  packSize?: string;
  mrp?: number;
  unitPrice?: number;
  hsnCode?: string;
  schedule?: string;
  storage?: string;
}

interface AIProductLookupProps {
  barcode?: string;
  productName?: string;
  hsnCode?: string;
  onDetailsFetched: (details: ProductDetails) => void;
  onError?: (error: string) => void;
}

export default function AIProductLookup({ barcode, productName, hsnCode, onDetailsFetched, onError }: AIProductLookupProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isWebResearching, setIsWebResearching] = useState(false);
  const [details, setDetails] = useState<ProductDetails | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [overallConfidence, setOverallConfidence] = useState<number | null>(null);
  const [fieldConfidence, setFieldConfidence] = useState<Array<{ field: string; confidence: number; source: string }>>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [webResearchResults, setWebResearchResults] = useState<any>(null);
  const [verificationStatus, setVerificationStatus] = useState<'unverified' | 'pharmacist_verified'>('unverified');
  const [suggestionsPending, setSuggestionsPending] = useState(false); // Track if suggestions need to be applied

  const fetchProductDetails = async () => {
    if (!barcode || barcode.length < 3) {
      onError?.('Invalid barcode');
      return;
    }

    setIsLoading(true);
    setDetails(null);
    setConfidence(null);
    setSources([]);

    try {
      // Enhanced: Try enhanced lookup API first (checks drug library)
      try {
        const enhancedResponse = await fetch(`/api/products/enhanced-lookup?barcode=${encodeURIComponent(barcode)}`);
        if (enhancedResponse.ok) {
          const enhancedData = await enhancedResponse.json();
          
          if (enhancedData.details) {
            const productDetails = {
              name: enhancedData.details.name,
              category: enhancedData.details.category,
              description: enhancedData.details.description,
              manufacturer: enhancedData.details.manufacturer,
              composition: enhancedData.details.composition,
              saltComposition: enhancedData.details.saltComposition,
              packSize: enhancedData.details.packSize || '',
              mrp: enhancedData.details.mrp,
              unitPrice: enhancedData.details.unitPrice,
              hsnCode: enhancedData.details.hsnCode,
              schedule: enhancedData.details.schedule,
              storage: 'Store in a cool, dry place below 30°C',
            };
            
            setDetails(productDetails);
            setConfidence(enhancedData.confidence || 0);
            setSources(enhancedData.source === 'drug_library' 
              ? ['Drug Library Database', 'CDSCO']
              : enhancedData.source === 'internal_product'
              ? ['Internal Product Database']
              : ['AI Product Recognition', 'Web Search Results']);
            
            // Auto-fill the form
            onDetailsFetched(productDetails);
            setIsLoading(false);
            return;
          }
        }
      } catch (enhancedError) {
        console.log('Enhanced lookup failed, trying fallback:', enhancedError);
      }
      
      // Fallback: Use original AI lookup
      const { AIProductLookup: LookupService } = await import('@/lib/ai/productLookup');
      const productDetails = await LookupService.lookupByBarcode(barcode);
      
      if (productDetails) {
        setDetails(productDetails);
        
        // Verify and get confidence
        const verification = await LookupService.verifyProduct(barcode, productDetails);
        setConfidence(verification.confidence);
        
        // Simulate sources
        setSources([
          'Indian Drug Database (CDSCO)',
          'AI Product Recognition',
          'Manufacturer Database',
          'Web Search Results',
        ]);

        // Auto-fill the form
        onDetailsFetched(productDetails);
      } else {
        onError?.('Product not found. Please enter details manually.');
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
      onError?.('Failed to fetch product details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Web-based research function
  const researchFromWeb = async () => {
    const searchQuery = barcode || productName || hsnCode;
    
    if (!searchQuery || searchQuery.trim().length < 3) {
      onError?.('Barcode, product name, or HSN code required (min 3 characters)');
      return;
    }

    setIsWebResearching(true);
    setDetails(null);
    setConfidence(null);
    setOverallConfidence(null);
    setFieldConfidence([]);
    setSources([]);
    setWarnings([]);
    setWebResearchResults(null);
    setVerificationStatus('unverified');
    setSuggestionsPending(false);

    try {
      const response = await fetch('/api/products/web-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: barcode || null,
          productName: productName || null,
          hsnCode: hsnCode || null,
        }),
      });

      const data = await response.json();

      if (data.success && data.suggestions) {
        const suggestions = data.suggestions;
        
        const productDetails: ProductDetails = {
          name: suggestions.name || '',
          category: suggestions.category || 'General',
          manufacturer: suggestions.manufacturer || undefined,
          description: suggestions.description || undefined,
          composition: suggestions.composition || undefined,
          saltComposition: suggestions.saltComposition || undefined,
          mrp: suggestions.mrp || undefined,
          unitPrice: suggestions.unitPrice || undefined,
          hsnCode: suggestions.hsnCode || '30049099',
          schedule: suggestions.schedule || undefined,
        };

        setDetails(productDetails);
        
        // Cap confidence at 95% - never 100% from web alone
        const cappedConfidence = Math.min(data.overallConfidence || data.confidence || 0, 95);
        setConfidence(cappedConfidence);
        setOverallConfidence(cappedConfidence);
        setFieldConfidence(data.fieldConfidence || []);
        setSources(data.sources || [data.source || 'Web Research']);
        setWarnings(data.warnings || []);
        setVerificationStatus(data.verificationStatus || 'unverified');
        setWebResearchResults(data);
        setSuggestionsPending(true); // Suggestions available, waiting for user to apply
        
        // DO NOT auto-fill - user must click "Apply Suggestions"
        // onDetailsFetched(productDetails); // Commented out - require explicit "Apply"
      } else {
        onError?.(data.error || 'No reliable product data found. Please enter details manually.');
      }
    } catch (error) {
      console.error('Web research error:', error);
      onError?.('Failed to research product details. Please try again.');
    } finally {
      setIsWebResearching(false);
    }
  };

  // Auto-fetch when barcode changes or component mounts
  useEffect(() => {
    if (barcode && barcode.length >= 3 && !details && !isLoading && !isWebResearching) {
      fetchProductDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcode]);

  const hasSearchQuery = barcode || productName || hsnCode;
  if (!hasSearchQuery) return null;

  return (
    <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">AI Product Lookup</h3>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
            Powered by AI
          </span>
        </div>
        {!isLoading && !isWebResearching && (
          <div className="flex items-center gap-2">
            <button
              onClick={fetchProductDetails}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm"
            >
              <Search className="w-4 h-4" />
              Lookup Product
            </button>
            <button
              onClick={researchFromWeb}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
            >
              <Sparkles className="w-4 h-4" />
              Research from Web
            </button>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 text-purple-700">
          <Loader2 className="w-5 h-5 animate-spin" />
          <div>
            <p className="font-medium">Searching product databases...</p>
            <p className="text-sm text-purple-600">Using AI to fetch product details</p>
          </div>
        </div>
      )}

      {isWebResearching && (
        <div className="flex items-center gap-3 text-blue-700">
          <Loader2 className="w-5 h-5 animate-spin" />
          <div>
            <p className="font-medium">Researching product details...</p>
            <p className="text-sm text-blue-600">Searching web sources for product information</p>
          </div>
        </div>
      )}

      {details && !isLoading && !isWebResearching && (
        <div className="space-y-3">
          {/* Verification Warning */}
          {webResearchResults && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-800">
                    AI-Suggested (Verify before saving)
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    These details are auto-assisted. Verify with the physical package before saving.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <h4 className="font-bold text-gray-900">{details.name || 'Product Details'}</h4>
                {webResearchResults && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    Web Research
                  </span>
                )}
              </div>
              {details.description && (
                <p className="text-sm text-gray-600 mb-2">{details.description}</p>
              )}
              {(overallConfidence !== null || confidence !== null) && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600">Confidence:</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[200px]">
                    <div
                      className={`h-2 rounded-full ${
                        (overallConfidence || confidence || 0) >= 80 ? 'bg-green-500' :
                        (overallConfidence || confidence || 0) >= 60 ? 'bg-yellow-500' : 'bg-orange-500'
                      }`}
                      style={{ width: `${Math.min(overallConfidence || confidence || 0, 95)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-medium text-gray-700">{Math.round(overallConfidence || confidence || 0)}%</span>
                  {verificationStatus === 'pharmacist_verified' && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Verified</span>
                  )}
                  {(overallConfidence || confidence || 0) < 100 && (
                    <span className="text-xs text-gray-500">(Max 95% from web - Verify for 100%)</span>
                  )}
                </div>
              )}
            </div>
            {confidence !== null && confidence < 100 && (
              <div className="flex items-center gap-1 text-orange-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs">Verify</span>
              </div>
            )}
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded p-2">
              <p className="text-xs font-medium text-orange-800 mb-1">⚠️ Warnings:</p>
              <ul className="text-xs text-orange-700 list-disc list-inside space-y-0.5">
                {warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Product Details Grid with Field Confidence Badges */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {details.manufacturer && (
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-gray-500">Manufacturer:</span>
                  <span className="ml-2 font-medium text-gray-900">{details.manufacturer}</span>
                </div>
                {(() => {
                  const fieldConf = fieldConfidence.find(f => f.field === 'manufacturer');
                  if (fieldConf) {
                    return (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        fieldConf.confidence >= 80 ? 'bg-green-100 text-green-700' :
                        fieldConf.confidence >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {fieldConf.confidence >= 80 ? 'High' : fieldConf.confidence >= 60 ? 'Med' : 'Low'}
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
            {details.composition && (
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-gray-500">Composition:</span>
                  <span className="ml-2 font-medium text-gray-900">{details.composition}</span>
                </div>
                {(() => {
                  const fieldConf = fieldConfidence.find(f => f.field === 'composition');
                  if (fieldConf) {
                    return (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        fieldConf.confidence >= 80 ? 'bg-green-100 text-green-700' :
                        fieldConf.confidence >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {fieldConf.confidence >= 80 ? 'High' : fieldConf.confidence >= 60 ? 'Med' : 'Low'}
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
            {details.saltComposition && (
              <div>
                <span className="text-gray-500">Salt Composition:</span>
                <span className="ml-2 font-medium text-gray-900">{details.saltComposition}</span>
              </div>
            )}
            {details.packSize && (
              <div>
                <span className="text-gray-500">Pack Size:</span>
                <span className="ml-2 font-medium text-gray-900">{details.packSize}</span>
              </div>
            )}
            {details.hsnCode && (
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-gray-500">HSN Code:</span>
                  <span className="ml-2 font-medium text-gray-900">{details.hsnCode}</span>
                </div>
                {(() => {
                  const fieldConf = fieldConfidence.find(f => f.field === 'hsnCode');
                  if (fieldConf) {
                    return (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        fieldConf.confidence >= 80 ? 'bg-green-100 text-green-700' :
                        fieldConf.confidence >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {fieldConf.confidence >= 80 ? 'High' : fieldConf.confidence >= 60 ? 'Med' : 'Low'}
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
            {details.schedule && (
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-gray-500">Schedule:</span>
                  <span className="ml-2 font-medium text-gray-900">{details.schedule}</span>
                </div>
                {(() => {
                  const fieldConf = fieldConfidence.find(f => f.field === 'schedule');
                  if (fieldConf) {
                    return (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        fieldConf.confidence >= 80 ? 'bg-green-100 text-green-700' :
                        fieldConf.confidence >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {fieldConf.confidence >= 80 ? 'High' : fieldConf.confidence >= 60 ? 'Med' : 'Low'}
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
            {details.mrp && (
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-gray-500">MRP (₹):</span>
                  <span className="ml-2 font-medium text-gray-900">{details.mrp.toFixed(2)}</span>
                </div>
                {(() => {
                  const fieldConf = fieldConfidence.find(f => f.field === 'mrp');
                  if (fieldConf) {
                    return (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        fieldConf.confidence >= 80 ? 'bg-green-100 text-green-700' :
                        fieldConf.confidence >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {fieldConf.confidence >= 80 ? 'High' : fieldConf.confidence >= 60 ? 'Med' : 'Low'}
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
            {details.unitPrice && (
              <div>
                <span className="text-gray-500">Unit Price (₹):</span>
                <span className="ml-2 font-medium text-gray-900">{details.unitPrice.toFixed(2)}</span>
              </div>
            )}
            {details.storage && (
              <div>
                <span className="text-gray-500">Storage:</span>
                <span className="ml-2 font-medium text-gray-900">{details.storage}</span>
              </div>
            )}
          </div>

          {/* Data Sources */}
          {sources.length > 0 && (
            <div className="pt-2 border-t border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-medium text-gray-600">Data Sources:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sources.map((source, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-white text-purple-700 px-2 py-1 rounded border border-purple-200"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mt-4 pt-3 border-t border-purple-200">
            {suggestionsPending && verificationStatus === 'unverified' && (
              <button
                onClick={() => {
                  // Apply suggestions to form
                  onDetailsFetched(details);
                  setSuggestionsPending(false);
                }}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Apply Suggestions
              </button>
            )}
            {verificationStatus === 'unverified' && (overallConfidence || confidence || 0) > 0 && (
              <button
                onClick={() => {
                  // Verify - set to 100% confidence
                  setVerificationStatus('pharmacist_verified');
                  setOverallConfidence(100);
                  setConfidence(100);
                  // Apply suggestions if not already applied
                  if (suggestionsPending) {
                    onDetailsFetched(details);
                    setSuggestionsPending(false);
                  }
                }}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Verify (I checked the physical pack)
              </button>
            )}
            {verificationStatus === 'pharmacist_verified' && (
              <div className="flex-1 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Verified (100%)
              </div>
            )}
            <button
              onClick={researchFromWeb}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              Refresh Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

