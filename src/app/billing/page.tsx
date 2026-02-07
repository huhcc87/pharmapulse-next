"use client";

import React, { useState, useEffect } from "react";
import { useSubscription } from "@/components/billing/SubscriptionProvider";
import { CreditCard, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Calendar, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function BillingPage() {
  const { status, refresh } = useSubscription();
  const [isLoading, setIsLoading] = useState(false);
  const [planSelect, setPlanSelect] = useState<{ plan: string; billingCycle: "monthly" | "yearly" } | null>(null);

  const decision = status?.decision;
  const sub = status?.subscription;
  const planConfig = status?.planConfig;

  // Check URL params for success/cancel
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      refresh();
      // Show success message (you can use a toast library)
      setTimeout(() => {
        window.history.replaceState({}, "", "/billing");
      }, 3000);
    }
    if (params.get("canceled") === "1") {
      // Show cancel message
      setTimeout(() => {
        window.history.replaceState({}, "", "/billing");
      }, 3000);
    }
  }, [refresh]);

  async function handleSubscribe(plan: string = "professional", billingCycle: "monthly" | "yearly" = "yearly") {
    setIsLoading(true);
    try {
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billingCycle }),
      });
      const data = await res.json();
      if (data?.error) {
        alert(`Error: ${data.error}`);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Subscribe error:", error);
      alert(`Failed to create checkout: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePortal() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/billing/create-portal-session", {
        method: "POST",
      });
      const data = await res.json();
      if (data?.error) {
        alert(`Error: ${data.error}`);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Portal error:", error);
      alert(`Failed to open billing portal: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = () => {
    if (!decision) return null;
    
    if (decision.ok) {
      if (decision.warning === "GRACE_PERIOD") {
        return (
          <Badge className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Grace Period
          </Badge>
        );
      }
      return (
        <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Active
        </Badge>
      );
    }
    
    return (
      <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700">
        <XCircle className="w-3 h-3 mr-1" />
        {decision.status === "expired" ? "Expired" : "Inactive"}
      </Badge>
    );
  };

  const isActive = decision?.ok === true;
  const inGrace = decision?.warning === "GRACE_PERIOD";

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Billing & Subscription</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your subscription and billing information</p>
      </div>

      {/* Current Subscription Status */}
      <Card className="mb-6 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl text-gray-900 dark:text-white">Current Subscription</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400 mt-1">
                {sub?.planDisplayName || "No active plan"}
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {decision?.status || sub?.status || "Inactive"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Period End
              </p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {formatDate(decision?.periodEnd || sub?.currentPeriodEnd)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Auto Renew</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {sub?.autoRenew ? "Yes" : "No"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                AI Credits
              </p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {sub?.aiCreditsRemaining !== undefined
                  ? `${sub.aiCreditsRemaining} / ${sub.aiCreditsAllocated || 0}`
                  : "—"}
              </p>
            </div>
          </div>

          {inGrace && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-900 dark:text-yellow-200">Grace Period</p>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300">
                    Your subscription has expired but you're in a grace period until {formatDate(decision?.graceUntil)}.
                    Renew soon to avoid service interruption.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isActive && !inGrace && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg mb-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                No active subscription. Subscribe to a plan to access all features.
              </p>
            </div>
          )}

          {/* Feature Flags Display */}
          {sub?.features && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Included Features:</p>
              <div className="flex flex-wrap gap-2">
                {sub.features.aiCopilot && (
                  <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                    AI Copilot
                  </Badge>
                )}
                {sub.features.rxOcr && (
                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                    Rx OCR
                  </Badge>
                )}
                {sub.features.offlinePos && (
                  <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                    Offline POS
                  </Badge>
                )}
                {sub.features.demandForecasting && (
                  <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800">
                    Demand Forecasting
                  </Badge>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <Button
              onClick={() => handleSubscribe("professional", "yearly")}
              disabled={isLoading}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {isActive ? "Change Plan" : "Subscribe to a Plan"}
            </Button>
            {isActive && sub?.stripeCustomerId && (
              <Button onClick={handlePortal} disabled={isLoading} variant="outline">
                Manage Billing
              </Button>
            )}
            <Button onClick={refresh} disabled={isLoading} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader>
          <CardTitle className="text-xl text-gray-900 dark:text-white">Billing History</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            View and download your invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isActive ? (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">No billing history yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Your invoices will appear here once payments are processed
              </p>
              <Button onClick={handlePortal} variant="outline" className="mt-4">
                View in Stripe Portal
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">No billing history</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Your billing history will appear here once you subscribe to a plan
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
