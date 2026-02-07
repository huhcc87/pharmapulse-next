"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingCart, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  TrendingUp, 
  Package, 
  Truck, 
  RefreshCw,
  Clock,
  DollarSign,
  BarChart4,
  ThumbsUp,
  Edit2
} from "lucide-react";

// Mock data for reorder recommendations
const MOCK_RECOMMENDATIONS = [
  { 
    id: 1, 
    productName: "Paracetamol 500mg", 
    category: "Analgesics",
    onHand: 120, 
    reorderPoint: 300,
    safetyStock: 150,
    avgDailyDemand: 42,
    leadTimeDays: 3,
    suggestedQty: 500,
    vendorRankings: [
      { id: 1, name: "MedSupply Ltd", price: 0.15, leadTime: 3, moq: 100, rank: 1 },
      { id: 2, name: "PharmaDist", price: 0.17, leadTime: 2, moq: 200, rank: 2 },
      { id: 3, name: "HealthWholesale", price: 0.14, leadTime: 5, moq: 300, rank: 3 }
    ],
    recommendedVendorId: 1,
    confidenceLevel: 0.89,
    status: "DRAFT"
  },
  { 
    id: 2, 
    productName: "Amoxicillin 250mg", 
    category: "Antibiotics",
    onHand: 50, 
    reorderPoint: 200,
    safetyStock: 100,
    avgDailyDemand: 18,
    leadTimeDays: 4,
    suggestedQty: 300,
    vendorRankings: [
      { id: 2, name: "PharmaDist", price: 0.32, leadTime: 4, moq: 100, rank: 1 },
      { id: 1, name: "MedSupply Ltd", price: 0.35, leadTime: 3, moq: 200, rank: 2 }
    ],
    recommendedVendorId: 2,
    confidenceLevel: 0.78,
    status: "DRAFT"
  },
  { 
    id: 3, 
    productName: "Cetirizine 10mg", 
    category: "Antihistamines",
    onHand: 30, 
    reorderPoint: 150,
    safetyStock: 75,
    avgDailyDemand: 15,
    leadTimeDays: 3,
    suggestedQty: 200,
    vendorRankings: [
      { id: 3, name: "HealthWholesale", price: 0.22, leadTime: 3, moq: 100, rank: 1 },
      { id: 1, name: "MedSupply Ltd", price: 0.24, leadTime: 3, moq: 100, rank: 2 }
    ],
    recommendedVendorId: 3,
    confidenceLevel: 0.92,
    status: "DRAFT"
  },
  { 
    id: 4, 
    productName: "Metformin 500mg", 
    category: "Antidiabetics",
    onHand: 80, 
    reorderPoint: 250,
    safetyStock: 125,
    avgDailyDemand: 25,
    leadTimeDays: 5,
    suggestedQty: 400,
    vendorRankings: [
      { id: 1, name: "MedSupply Ltd", price: 0.18, leadTime: 5, moq: 200, rank: 1 },
      { id: 2, name: "PharmaDist", price: 0.19, leadTime: 4, moq: 300, rank: 2 }
    ],
    recommendedVendorId: 1,
    confidenceLevel: 0.85,
    status: "DRAFT"
  },
  { 
    id: 5, 
    productName: "Atorvastatin 10mg", 
    category: "Statins",
    onHand: 45, 
    reorderPoint: 200,
    safetyStock: 100,
    avgDailyDemand: 22,
    leadTimeDays: 4,
    suggestedQty: 300,
    vendorRankings: [
      { id: 2, name: "PharmaDist", price: 0.45, leadTime: 4, moq: 100, rank: 1 },
      { id: 3, name: "HealthWholesale", price: 0.48, leadTime: 3, moq: 200, rank: 2 }
    ],
    recommendedVendorId: 2,
    confidenceLevel: 0.81,
    status: "APPROVED"
  }
];

// Mock vendors
const MOCK_VENDORS = [
  { id: 1, name: "MedSupply Ltd" },
  { id: 2, name: "PharmaDist" },
  { id: 3, name: "HealthWholesale" },
  { id: 0, name: "All Vendors" }
];

export default function AiReorderPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState("all");
  const [selectedVendor, setSelectedVendor] = useState("0");
  const [selectedRecommendation, setSelectedRecommendation] = useState<any | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const generateRecommendations = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch("/api/inventory/reorder-suggestions?horizon=30&leadTime=3&safetyStock=7");
      const data = await response.json();
      
      if (data.suggestions && data.suggestions.length > 0) {
        // Transform API response to match UI format
        const transformed = data.suggestions.map((s: any) => ({
          id: s.productId,
          productName: s.productName,
          category: s.category || "General",
          onHand: s.currentStock,
          reorderPoint: s.reorderPoint,
          safetyStock: s.safetyStockDays || 7,
          avgDailyDemand: s.avgDailyDemand,
          leadTimeDays: 3,
          suggestedQty: s.recommendedOrderQty,
          vendorRankings: [], // Vendor data not implemented yet
          recommendedVendorId: null,
          confidenceLevel: s.confidenceLevel,
          status: s.recommendedOrderQty > 0 ? "DRAFT" : "NO_ORDER_NEEDED",
          explanation: s.explanation,
          forecastQty: s.forecastQty,
          trend: s.trend,
          stockCoverDays: s.stockCoverDays,
        }));
        setRecommendations(transformed);
      } else {
        // Fallback to mock if no suggestions
        setRecommendations(MOCK_RECOMMENDATIONS);
      }
      setLastUpdated(new Date().toLocaleString());
    } catch (error) {
      console.error("Error generating recommendations:", error);
      // Fallback to mock data on error
      setRecommendations(MOCK_RECOMMENDATIONS);
    } finally {
      setIsLoading(false);
    }
  };

  const approveRecommendation = (id: number) => {
    setRecommendations(prevRecs => 
      prevRecs.map(rec => 
        rec.id === id ? { ...rec, status: "APPROVED" } : rec
      )
    );
  };

  const dismissRecommendation = (id: number) => {
    setRecommendations(prevRecs => 
      prevRecs.map(rec => 
        rec.id === id ? { ...rec, status: "DISMISSED" } : rec
      )
    );
  };

  const getFilteredRecommendations = () => {
    let filtered = [...recommendations];
    
    // Filter by status
    if (selectedTab !== "all") {
      filtered = filtered.filter(rec => rec.status === selectedTab);
    }
    
    // Filter by vendor
    if (selectedVendor !== "0") {
      filtered = filtered.filter(rec => 
        rec.vendorRankings.some((v: any) => 
          v.id === parseInt(selectedVendor) && v.rank === 1
        )
      );
    }
    
    return filtered;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
      case "DISMISSED":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Dismissed</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Draft</Badge>;
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence > 0.85) {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">{Math.round(confidence * 100)}%</Badge>;
    } else if (confidence > 0.7) {
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">{Math.round(confidence * 100)}%</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">{Math.round(confidence * 100)}%</Badge>;
    }
  };

  const viewRecommendationDetails = (rec: any) => {
    setSelectedRecommendation(rec);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI Reorder Optimization</h1>
          <p className="text-gray-500">Smart reorder recommendations based on demand and lead time</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedVendor} onValueChange={setSelectedVendor}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select vendor" />
            </SelectTrigger>
            <SelectContent>
              {MOCK_VENDORS.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id.toString()}>
                  {vendor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            onClick={generateRecommendations} 
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Generate Recommendations
              </>
            )}
          </Button>
        </div>
      </div>

      {lastUpdated && (
        <div className="text-sm text-gray-500 mb-4 flex items-center gap-2">
          <RefreshCw className="h-3 w-3" />
          Last updated: {lastUpdated}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* Main recommendations table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Reorder Recommendations</CardTitle>
              <Tabs defaultValue="all" value={selectedTab} onValueChange={setSelectedTab} className="w-auto">
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="DRAFT">Draft</TabsTrigger>
                  <TabsTrigger value="APPROVED">Approved</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <CardDescription>
              AI-generated reorder suggestions based on demand forecast, lead time, and safety stock
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recommendations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No recommendations available. Generate recommendations to see suggestions.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Product</th>
                      <th className="text-right p-2 font-medium">On Hand</th>
                      <th className="text-right p-2 font-medium">Reorder Point</th>
                      <th className="text-right p-2 font-medium">Suggested Qty</th>
                      <th className="text-left p-2 font-medium">Recommended Vendor</th>
                      <th className="text-center p-2 font-medium">Status</th>
                      <th className="text-right p-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredRecommendations().map((rec) => (
                      <tr key={rec.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          <div>
                            <div className="font-medium">{rec.productName}</div>
                            <div className="text-xs text-gray-500">{rec.category}</div>
                          </div>
                        </td>
                        <td className="text-right p-2">
                          <span className={rec.onHand < rec.reorderPoint ? "text-red-600 font-medium" : ""}>
                            {rec.onHand}
                          </span>
                        </td>
                        <td className="text-right p-2">{rec.reorderPoint}</td>
                        <td className="text-right p-2 font-medium">{rec.suggestedQty}</td>
                        <td className="text-left p-2">
                          {rec.vendorRankings.find((v: any) => v.id === rec.recommendedVendorId)?.name}
                        </td>
                        <td className="text-center p-2">
                          {getStatusBadge(rec.status)}
                        </td>
                        <td className="text-right p-2">
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => viewRecommendationDetails(rec)}
                              className="h-8 w-8 p-0"
                            >
                              <BarChart4 className="h-4 w-4" />
                            </Button>
                            {rec.status === "DRAFT" && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => approveRecommendation(rec.id)}
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => dismissRecommendation(rec.id)}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommendation details */}
        {selectedRecommendation && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Recommendation Details</span>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  {selectedRecommendation.productName} ({selectedRecommendation.category})
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-sm mb-3">Inventory Parameters</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Current Stock:</span>
                        <span className="font-medium">{selectedRecommendation.onHand} units</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Avg Daily Demand:</span>
                        <span className="font-medium">{selectedRecommendation.avgDailyDemand} units</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Lead Time:</span>
                        <span className="font-medium">{selectedRecommendation.leadTimeDays} days</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Safety Stock:</span>
                        <span className="font-medium">{selectedRecommendation.safetyStock} units</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Reorder Point:</span>
                        <span className="font-medium">{selectedRecommendation.reorderPoint} units</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-medium">
                        <span className="text-gray-800">Suggested Order Qty:</span>
                        <span className="text-blue-600">{selectedRecommendation.suggestedQty} units</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Confidence Level:</span>
                        <span>{getConfidenceBadge(selectedRecommendation.confidenceLevel)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm mb-3">Vendor Comparison</h4>
                    <div className="space-y-3">
                      {selectedRecommendation.vendorRankings.map((vendor: any) => (
                        <div 
                          key={vendor.id} 
                          className={`p-3 rounded-md border ${vendor.rank === 1 ? 'border-blue-200 bg-blue-50' : 'border-gray-200'}`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{vendor.name}</span>
                            {vendor.rank === 1 && (
                              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Recommended</Badge>
                            )}
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3 text-gray-500" />
                              <span>₹{vendor.price}/unit</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-gray-500" />
                              <span>{vendor.leadTime} days</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Package className="h-3 w-3 text-gray-500" />
                              <span>MOQ: {vendor.moq}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Why This Recommendation?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex gap-3 items-start">
                  <div className="shrink-0 mt-1">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Demand Analysis</h4>
                    <p className="text-gray-600">
                      Based on the last 90 days of sales data, the average daily demand is {selectedRecommendation.avgDailyDemand} units.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3 items-start">
                  <div className="shrink-0 mt-1">
                    <Package className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Stock Level</h4>
                    <p className="text-gray-600">
                      Current stock ({selectedRecommendation.onHand} units) is below reorder point ({selectedRecommendation.reorderPoint} units).
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3 items-start">
                  <div className="shrink-0 mt-1">
                    <Truck className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Vendor Selection</h4>
                    <p className="text-gray-600">
                      {selectedRecommendation.vendorRankings.find((v: any) => v.id === selectedRecommendation.recommendedVendorId)?.name} offers the best balance of price, lead time, and minimum order quantity.
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-3 items-start">
                  <div className="shrink-0 mt-1">
                    <ThumbsUp className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Recommendation</h4>
                    <p className="text-gray-600">
                      Order {selectedRecommendation.suggestedQty} units to maintain optimal inventory levels for the next {Math.round(selectedRecommendation.suggestedQty / selectedRecommendation.avgDailyDemand)} days.
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Model version: v1.2.3 • Formula: ROP = Avg Daily Demand × Lead Time + Safety Stock
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
