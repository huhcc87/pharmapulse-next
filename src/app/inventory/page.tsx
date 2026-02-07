"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Plus, Trash2, Edit, AlertTriangle, Download, Scan, Package } from "lucide-react";
import { useBarcodeWedge } from "@/hooks/useBarcodeWedge";
import { resolveBarcode } from "@/lib/barcode/resolver";
import ScanToInventoryModal from "@/components/ScanToInventoryModal";
import DrugLibraryModal from "@/components/DrugLibraryModal";
import AddProductModal from "@/components/AddProductModal";

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanToInventory, setShowScanToInventory] = useState(false);
  const [drugLibraryOpen, setDrugLibraryOpen] = useState(false);
  const [scannedDrug, setScannedDrug] = useState<any>(null);
  const [pendingBarcode, setPendingBarcode] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/inventory/items");
      if (response.ok) {
        const data = await response.json();
        setProducts(data.items || []);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDeleteProduct = async (productId: number, drugLibraryId?: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const endpoint = drugLibraryId 
        ? `/api/inventory/items/${productId}`
        : `/api/products/${productId}`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchProducts();
        const successMsg = document.createElement('div');
        successMsg.className = 'fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        successMsg.innerHTML = '✓ Product deleted successfully!';
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
      } else {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to delete product');
      }
    } catch (error: any) {
      console.error('Error deleting product:', error);
      const errorMsg = document.createElement('div');
      errorMsg.className = 'fixed top-20 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      errorMsg.innerHTML = `✗ Failed to delete: ${error?.message || 'Unknown error'}`;
      document.body.appendChild(errorMsg);
      setTimeout(() => errorMsg.remove(), 5000);
    }
  };

  useBarcodeWedge(
    async (code) => {
      console.log("🔍 Barcode scanned in inventory:", code);
      
      const activeEl = document.activeElement;
      if (activeEl && activeEl !== searchInputRef.current && searchTerm.trim()) {
        console.log("⏭️ Skipping - user typing in different field");
        return;
      }

      // Normalize: remove whitespace
      const normalizedCode = code.trim().replace(/[^\d]/g, "");

      // Detect barcode type by length (8=EAN8, 12=UPCA, 13=EAN13)
      let detectedType = "";
      if (normalizedCode.length === 13) detectedType = "EAN13";
      else if (normalizedCode.length === 8) detectedType = "EAN8";
      else if (normalizedCode.length === 12) detectedType = "UPCA";

      setSearchTerm(code);

      try {
        // Call /api/products/by-barcode to lookup product by barcodeValue + barcodeTypeEnum
        const res = await fetch(`/api/products/by-barcode?code=${encodeURIComponent(normalizedCode)}${detectedType ? `&type=${detectedType}` : ""}`);
        
        // Check if response is OK before parsing JSON
        if (!res.ok) {
          const errorText = await res.text().catch(() => 'Unknown error');
          console.error("❌ API error:", res.status, errorText);
          throw new Error(`API returned ${res.status}: ${errorText || 'Unknown error'}`);
        }

        // Parse JSON only if response is OK
        let data;
        try {
          const text = await res.text();
          if (!text || text.trim() === '') {
            throw new Error('Empty response from server');
          }
          data = JSON.parse(text);
        } catch (parseError) {
          console.error("❌ JSON parse error:", parseError);
          throw new Error('Invalid response from server');
        }

        if (data.found && data.product) {
          console.log("✅ Found product by barcode:", data.product.name);
          
          // Convert Product to DrugLibrary-like format for compatibility with existing modal
          const drugFormat = {
            id: data.product.id,
            brandName: data.product.name,
            qrCode: data.product.barcode || normalizedCode,
            priceInr: String(data.product.salePrice || 0),
            dpcoCeilingPriceInr: data.product.mrp,
            gstPercent: data.product.gstRate || 12,
            packSize: null,
            manufacturer: data.product.manufacturer,
            category: data.product.category,
          };

          setScannedDrug(drugFormat);
          setShowScanToInventory(true);
          setSearchTerm("");
          
          const successMsg = document.createElement('div');
          successMsg.className = 'fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
          successMsg.innerHTML = `✓ Found: ${data.product.name}`;
          document.body.appendChild(successMsg);
          setTimeout(() => successMsg.remove(), 3000);
        } else {
          // Not found - try resolveBarcode as fallback for DrugLibrary
          console.log("❌ Not found in Product, trying DrugLibrary...");
          try {
            const result = await resolveBarcode(code, 1, 1);
            if (result.found === "library") {
              console.log("📚 Found in DrugLibrary:", result.drug.brandName);
              setScannedDrug(result.drug);
              setShowScanToInventory(true);
              setSearchTerm("");
            } else {
              // Not found anywhere
              console.log("❌ Not found anywhere");
              setSearchTerm(code);
              setPendingBarcode(normalizedCode);
              setShowAddModal(true);
              
              const errorMsg = document.createElement('div');
              errorMsg.className = 'fixed top-20 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
              errorMsg.innerHTML = `⚠ Barcode "${code}" not found. You can add it manually.`;
              document.body.appendChild(errorMsg);
              setTimeout(() => errorMsg.remove(), 5000);
            }
          } catch (resolveError) {
            console.error("❌ ResolveBarcode error:", resolveError);
            setPendingBarcode(normalizedCode);
            setShowAddModal(true);
          }
        }
      } catch (error: any) {
        console.error("❌ Barcode lookup error:", error);
        const errorMsg = document.createElement('div');
        errorMsg.className = 'fixed top-20 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        errorMsg.innerHTML = `⚠ Error looking up barcode: ${error?.message || "Unknown error"}`;
        document.body.appendChild(errorMsg);
        setTimeout(() => errorMsg.remove(), 5000);
        setPendingBarcode(normalizedCode);
        setShowAddModal(true);
      }
    },
    { minLen: 3, timeoutMs: 100 }
  );

  const filteredProducts = products.filter((item) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.drugLibrary?.brandName?.toLowerCase().includes(search) ||
      item.drugLibrary?.qrCode?.toLowerCase().includes(search) ||
      item.drugLibrary?.manufacturer?.toLowerCase().includes(search)
    );
  });

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #inventory-table, #inventory-table * {
            visibility: visible;
          }
          #inventory-table {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Inventory Management</h1>
            <p className="text-gray-600 mt-1">Manage your pharmacy inventory</p>
      </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center space-x-3">
          <button 
              onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
          <button 
              onClick={() => setDrugLibraryOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <Package className="w-4 h-4" />
            <span>Drug Library</span>
          </button>
            <button
              onClick={() => window.print()}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
        </div>

      {/* Search Bar */}
        <div className="mb-6 no-print">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            ref={searchInputRef}
            type="text"
            data-scanner="true"
            placeholder="Search inventory or scan barcode to add products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="w-full pl-10 pr-32 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            autoFocus
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className={`flex items-center gap-2 text-xs ${isSearchFocused ? 'text-green-600' : 'text-gray-400'}`}>
              <span className={`w-2 h-2 rounded-full ${isSearchFocused ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></span>
              <span>{isSearchFocused ? 'Scanner Ready' : 'Click to scan'}</span>
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          💡 Point your barcode scanner here and scan. Items found in library will prompt to add to inventory.
        </div>
      </div>

      {/* Inventory Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-0">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200" id="inventory-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product Name / Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Min Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Loading products...
                  </td>
                </tr>
                ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      {searchTerm ? "No products found matching your search." : "No products in inventory."}
                  </td>
                </tr>
              ) : (
                  filteredProducts.map((item) => (
                  <tr key={item.id} id={`product-${item.id}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                          <div className="font-medium text-gray-900">
                            {item.drugLibrary?.brandName || "Unknown Product"}
                          </div>
                          <div className="text-sm text-gray-500">
                            {item.drugLibrary?.qrCode && `Code: ${item.drugLibrary.qrCode}`}
                            {item.drugLibrary?.manufacturer && ` • ${item.drugLibrary.manufacturer}`}
                          </div>
                      </div>
                    </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.drugLibrary?.category || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          item.qtyOnHand <= (item.reorderLevel || 0)
                            ? "bg-red-100 text-red-800"
                            : "bg-green-100 text-green-800"
                        }`}>
                          {item.qtyOnHand || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{item.sellingPrice?.toFixed(2) || "0.00"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.reorderLevel || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        {item.qtyOnHand <= (item.reorderLevel || 0) ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            Low Stock
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            In Stock
                          </span>
                      )}
                    </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleDeleteProduct(item.id, item.drugLibraryId)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

        {showScanToInventory && scannedDrug && (
        <ScanToInventoryModal
          isOpen={showScanToInventory}
            drug={scannedDrug}
          onClose={() => {
            setShowScanToInventory(false);
            setScannedDrug(null);
          }}
            onAdd={async (data) => {
              try {
                const response = await fetch("/api/inventory/add-from-qr", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    qrCode: scannedDrug.qrCode,
                    ...data,
                  }),
                });
                if (!response.ok) throw new Error("Failed to add to inventory");
                fetchProducts();
                setShowScanToInventory(false);
                setScannedDrug(null);
              } catch (error: any) {
                console.error("Error adding to inventory:", error);
                alert(`Failed to add: ${error?.message || "Unknown error"}`);
              }
            }}
          />
        )}

        {showAddModal && (
          <AddProductModal
            isOpen={showAddModal}
            scannedBarcode={pendingBarcode}
            onClose={() => {
              setShowAddModal(false);
              setPendingBarcode("");
            }}
            onAdd={async (product) => {
              try {
                // Product is already created by AddProductModal
                // Just refresh inventory and close modal
                await fetchProducts();
                setShowAddModal(false);
                setPendingBarcode("");
                
                // Show success message
                const successMsg = document.createElement('div');
                successMsg.className = 'fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
                successMsg.innerHTML = `✓ ${product.productName} added to inventory! You can now scan barcode to add to POS cart.`;
                document.body.appendChild(successMsg);
                setTimeout(() => successMsg.remove(), 4000);
              } catch (error: any) {
                console.error("Error refreshing inventory:", error);
              }
            }}
          />
        )}

        <DrugLibraryModal
          isOpen={drugLibraryOpen}
          onClose={() => setDrugLibraryOpen(false)}
          onSelectDrug={async (drug) => {
            try {
              // Add drug from library to inventory
              const response = await fetch("/api/inventory/add-from-library", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  drugLibraryId: drug.id,
                  qtyOnHand: 0, // Default quantity
                  tenantId: 1, // Default tenant ID
                }),
              });
              
              if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || "Failed to add drug to inventory");
              }
              
              // Refresh inventory list
              fetchProducts();
              setDrugLibraryOpen(false);
              
              // Show success message
              const successMsg = document.createElement('div');
              successMsg.className = 'fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
              successMsg.innerHTML = `✓ ${drug.brandName} added to inventory!`;
              document.body.appendChild(successMsg);
              setTimeout(() => successMsg.remove(), 3000);
            } catch (error: any) {
              console.error("Error adding drug to inventory:", error);
              alert(`Failed to add drug: ${error?.message || "Unknown error"}`);
            }
          }}
        />
    </div>
    </>
  );
}
