"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Tag,
  ArrowRight,
  TruckIcon,
  Trash2,
  BarChart4
} from "lucide-react";

// Mock data for expiry risk
const MOCK_EXPIRY_ITEMS = [
  { 
    id: 1, 
    productName: "Paracetamol 500mg", 
    batchCode: "PC500-2023-A",
    expiryDate: "2026-01-15", 
    daysToExpiry: 22, 
    qtyOnHand: 120, 
    valueAtRisk: 1800,
    riskLevel: "AT_RISK",
    riskScore: 75,
    suggestedActions: ["DISCOUNT", "TRANSFER"]
  },
  { 
    id: 2, 
    productName: "Amoxicillin 250mg", 
    batchCode: "AM250-2023-C",
    expiryDate: "2026-01-30", 
    daysToExpiry: 37, 
    qtyOnHand: 85, 
    valueAtRisk: 2720,
    riskLevel: "WATCH",
    riskScore: 45,
    suggestedActions: ["TRANSFER"]
  },
  { 
    id: 3, 
    productName: "Cetirizine 10mg", 
    batchCode: "CT10-2023-B",
    expiryDate: "2026-02-10", 
    daysToExpiry: 48, 
    qtyOnHand: 200, 
    valueAtRisk: 3000,
    riskLevel: "WATCH",
    riskScore: 40,
    suggestedActions: ["MONITOR"]
  },
  { 
    id: 4, 
    productName: "Metformin 500mg", 
    batchCode: "MT500-2023-A",
    expiryDate: "2025-12-30", 
    daysToExpiry: 6, 
    qtyOnHand: 50, 
    valueAtRisk: 1000,
    riskLevel: "EXPIRED",
    riskScore: 100,
    suggestedActions: ["WRITE_OFF", "VENDOR_RETURN"]
  },
  { 
    id: 5, 
    productName: "Losartan 50mg", 
    batchCode: "LS50-2023-B",
    expiryDate: "2026-03-15", 
    daysToExpiry: 81, 
    qtyOnHand: 75, 
    valueAtRisk: 2250,
    riskLevel: "SAFE",
    riskScore: 20,
    suggestedActions: ["MONITOR"]
  }
];

// Mock proposed actions
const MOCK_ACTIONS = [
  {
    id: 1,
    productName: "Metformin 500mg",
    batchCode: "MT500-2023-A",
    actionType: "WRITE_OFF",
    status: "PROPOSED",
    proposedQty: 50,
    valueImpact: 1000,
    proposedBy: "AI System",
    proposedAt: "2025-12-22 10:30 AM"
  },
  {
    id: 2,
    productName: "Paracetamol 500mg",
    batchCode: "PC500-2023-A",
    actionType: "DISCOUNT",
    status: "APPROVED",
    proposedQty: 120,
    discountPercent: 30,
    valueImpact: 540,
    proposedBy: "AI System",
    proposedAt: "2025-12-21 02:15 PM",
    approvedBy: "John Pharmacist",
    approvedAt: "2025-12-22 09:45 AM"
  },
  {
    id: 3,
    productName: "Amoxicillin 250mg",
    batchCode: "AM250-2023-C",
    actionType: "TRANSFER",
    status: "EXECUTED",
    proposedQty: 40,
    transferLocation: "Branch #2",
    valueImpact: 1280,
    proposedBy: "AI System",
    proposedAt: "2025-12-20 11:20 AM",
    approvedBy: "John Pharmacist",
    approvedAt: "2025-12-20 03:30 PM",
    executedBy: "Sarah Manager",
    executedAt: "2025-12-21 10:00 AM"
  }
];

export default function ExpiryCenterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [expiryItems, setExpiryItems] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [selectedTab, setSelectedTab] = useState("at_risk");
  const [selectedActionTab, setSelectedActionTab] = useState("proposed");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const runExpiryAnalysis = async () => {
    setIsLoading(true);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setExpiryItems(MOCK_EXPIRY_ITEMS);
      setActions(MOCK_ACTIONS);
      setLastUpdated(new Date().toLocaleString());
    } catch (error) {
      console.error("Error running expiry analysis:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredItems = () => {
    if (!expiryItems.length) return [];
    
    switch (selectedTab) {
      case "at_risk":
        return expiryItems.filter(item => item.riskLevel === "AT_RISK");
      case "expired":
        return expiryItems.filter(item => item.riskLevel === "EXPIRED");
      case "watch":
        return expiryItems.filter(item => item.riskLevel === "WATCH");
      case "safe":
        return expiryItems.filter(item => item.riskLevel === "SAFE");
      default:
        return expiryItems;
    }
  };

  const getFilteredActions = () => {
    if (!actions.length) return [];
    
    switch (selectedActionTab) {
      case "proposed":
        return actions.filter(action => action.status === "PROPOSED");
      case "approved":
        return actions.filter(action => action.status === "APPROVED");
      case "executed":
        return actions.filter(action => action.status === "EXECUTED");
      default:
        return actions;
    }
  };

  const getRiskBadge = (riskLevel: string) => {
    switch (riskLevel) {
      case "EXPIRED":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Expired</Badge>;
      case "AT_RISK":
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">At Risk</Badge>;
      case "WATCH":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Watch</Badge>;
      case "SAFE":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Safe</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case "DISCOUNT":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Discount</Badge>;
      case "TRANSFER":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Transfer</Badge>;
      case "VENDOR_RETURN":
        return <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">Vendor Return</Badge>;
      case "WRITE_OFF":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Write Off</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PROPOSED":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Proposed</Badge>;
      case "APPROVED":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Approved</Badge>;
      case "EXECUTED":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Executed</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "DISCOUNT":
        return <Tag className="h-4 w-4 text-blue-600" />;
      case "TRANSFER":
        return <TruckIcon className="h-4 w-4 text-purple-600" />;
      case "VENDOR_RETURN":
        return <ArrowRight className="h-4 w-4 text-indigo-600" />;
      case "WRITE_OFF":
        return <Trash2 className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const viewItemDetails = (item: any) => {
    setSelectedItem(item);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Expiry Center</h1>
          <p className="text-gray-500">Proactive expiry management to reduce waste</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={runExpiryAnalysis} 
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Clock className="h-4 w-4" />
                Run Expiry Analysis
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main expiry table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Expiry Risk Analysis</CardTitle>
                <Tabs defaultValue="at_risk" value={selectedTab} onValueChange={setSelectedTab} className="w-auto">
                  <TabsList>
                    <TabsTrigger value="at_risk">At Risk</TabsTrigger>
                    <TabsTrigger value="expired">Expired</TabsTrigger>
                    <TabsTrigger value="watch">Watch</TabsTrigger>
                    <TabsTrigger value="safe">Safe</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <CardDescription>
                Batches analyzed for expiry risk with recommended actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {expiryItems.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No expiry data available. Run expiry analysis to see results.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Product</th>
                        <th className="text-left p-2 font-medium">Batch</th>
                        <th className="text-right p-2 font-medium">Expires In</th>
                        <th className="text-right p-2 font-medium">Qty</th>
                        <th className="text-right p-2 font-medium">Value at Risk</th>
                        <th className="text-center p-2 font-medium">Risk Level</th>
                        <th className="text-right p-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredItems().map((item) => (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">
                            <div className="font-medium">{item.productName}</div>
                          </td>
                          <td className="p-2">{item.batchCode}</td>
                          <td className="text-right p-2">
                            <span className={
                              item.daysToExpiry <= 7 ? "text-red-600 font-medium" : 
                              item.daysToExpiry <= 30 ? "text-amber-600 font-medium" : ""
                            }>
                              {item.daysToExpiry} days
                            </span>
                          </td>
                          <td className="text-right p-2">{item.qtyOnHand}</td>
                          <td className="text-right p-2">₹{item.valueAtRisk}</td>
                          <td className="text-center p-2">
                            {getRiskBadge(item.riskLevel)}
                          </td>
                          <td className="text-right p-2">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => viewItemDetails(item)}
                                className="h-8 w-8 p-0"
                              >
                                <BarChart4 className="h-4 w-4" />
                              </Button>
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

          {/* Actions Queue */}
          {actions.length > 0 && (
            <Card className="mt-6">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Actions Queue</CardTitle>
                  <Tabs defaultValue="proposed" value={selectedActionTab} onValueChange={setSelectedActionTab} className="w-auto">
                    <TabsList>
                      <TabsTrigger value="proposed">Proposed</TabsTrigger>
                      <TabsTrigger value="approved">Approved</TabsTrigger>
                      <TabsTrigger value="executed">Executed</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <CardDescription>
                  Recommended actions to handle expiring inventory
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Product</th>
                        <th className="text-left p-2 font-medium">Action Type</th>
                        <th className="text-right p-2 font-medium">Qty</th>
                        <th className="text-right p-2 font-medium">Value Impact</th>
                        <th className="text-center p-2 font-medium">Status</th>
                        <th className="text-right p-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredActions().map((action) => (
                        <tr key={action.id} className="border-b hover:bg-gray-50">
                          <td className="p-2">
                            <div>
                              <div className="font-medium">{action.productName}</div>
                              <div className="text-xs text-gray-500">{action.batchCode}</div>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {getActionIcon(action.actionType)}
                              {getActionBadge(action.actionType)}
                            </div>
                          </td>
                          <td className="text-right p-2">{action.proposedQty}</td>
                          <td className="text-right p-2">₹{action.valueImpact}</td>
                          <td className="text-center p-2">
                            {getStatusBadge(action.status)}
                          </td>
                          <td className="text-right p-2">
                            <div className="flex justify-end gap-2">
                              {action.status === "PROPOSED" && (
                                <>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {action.status === "APPROVED" && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                                >
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div>
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>Expiry Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {expiryItems.length === 0 ? (
                <p className="text-gray-500">Run analysis to see summary</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Total Batches:</span>
                    <span className="font-medium">{expiryItems.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Expired:</span>
                    <span className="font-medium">{expiryItems.filter(i => i.riskLevel === "EXPIRED").length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">At Risk (&lt; 30 days):</span>
                    <span className="font-medium">{expiryItems.filter(i => i.riskLevel === "AT_RISK").length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Watch (30-60 days):</span>
                    <span className="font-medium">{expiryItems.filter(i => i.riskLevel === "WATCH").length}</span>
                  </div>
                  <div className="flex justify-between items-center font-medium">
                    <span className="text-gray-800">Total Value at Risk:</span>
                    <span className="text-red-600">₹{expiryItems.reduce((sum, item) => sum + item.valueAtRisk, 0)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected Item Details */}
          {selectedItem && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Batch Details</CardTitle>
                <CardDescription>{selectedItem.productName} ({selectedItem.batchCode})</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Expiry Date:</span>
                  <span className="font-medium">{selectedItem.expiryDate}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Days Remaining:</span>
                  <span className={
                    selectedItem.daysToExpiry <= 7 ? "text-red-600 font-medium" : 
                    selectedItem.daysToExpiry <= 30 ? "text-amber-600 font-medium" : 
                    "font-medium"
                  }>
                    {selectedItem.daysToExpiry} days
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Quantity on Hand:</span>
                  <span className="font-medium">{selectedItem.qtyOnHand} units</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Value at Risk:</span>
                  <span className="font-medium">₹{selectedItem.valueAtRisk}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Risk Score:</span>
                  <span className="font-medium">{selectedItem.riskScore}/100</span>
                </div>
                
                <div className="pt-3 border-t border-gray-200">
                  <h4 className="font-medium mb-2">Suggested Actions:</h4>
                  <div className="space-y-2">
                    {selectedItem.suggestedActions.map((action: string, index: number) => (
                      <div key={index} className="flex items-center gap-2">
                        {getActionIcon(action)}
                        <span>{action.replace("_", " ").toLowerCase()
                          .replace(/\b\w/g, l => l.toUpperCase())}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="pt-3">
                  <Button className="w-full">
                    Create Action Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* FEFO Compliance */}
          <Card className="mt-6 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
                FEFO Compliance
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="text-gray-600 mb-3">
                First-Expiry-First-Out enforcement is active for all POS transactions.
              </p>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">FEFO Compliance Rate:</span>
                <span className="font-medium text-green-600">98.2%</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-gray-500">FEFO Overrides:</span>
                <span className="font-medium">5 this month</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
