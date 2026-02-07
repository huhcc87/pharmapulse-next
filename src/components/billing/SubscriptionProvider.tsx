"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { apiFetch } from "@/lib/apiClient";

type Ctx = {
  status: any;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<Ctx | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<any>(null);

  const refresh = useCallback(async () => {
    // Only run on client side
    if (typeof window === "undefined") return;
    
    try {
      const res = await apiFetch("/api/billing/status");
      
      // Always try to parse as JSON - API should always return valid JSON
      let data: any = null;
      try {
        const text = await res.text();
        if (text && text.trim().startsWith('{')) {
          data = JSON.parse(text);
        }
      } catch (parseError) {
        console.warn("Failed to parse subscription status (non-fatal):", parseError);
        // Use default inactive status if parsing fails
        data = {
          plan: { name: null, status: 'INACTIVE', purchasedAt: null, amountPaise: null, branchesIncluded: 1, prioritySupport: false },
          renewal: { status: 'INACTIVE', nextDue: null, isPastDue: false },
          credits: { balance: 0, monthlyGrant: 10000, yearlyLimit: 120000, used: 0, yearlyUsed: 0, monthlyUsed: 0, remaining: 0, remainingYearly: 120000, remainingMonthly: 10000 },
        };
      }

      // If response has error field, use default inactive status (API should never return error anymore)
      if (data?.error && data.error !== 'UNAUTHORIZED') {
        console.warn("Subscription status API returned error (using default):", data.error);
        data = {
          plan: { name: null, status: 'INACTIVE', purchasedAt: null, amountPaise: null, branchesIncluded: 1, prioritySupport: false },
          renewal: { status: 'INACTIVE', nextDue: null, isPastDue: false },
          credits: { balance: 0, monthlyGrant: 10000, yearlyLimit: 120000, used: 0, yearlyUsed: 0, monthlyUsed: 0, remaining: 0, remainingYearly: 120000, remainingMonthly: 10000 },
        };
      }

      // Always set valid status structure (never set { error: true })
      setStatus(data || {
        plan: { name: null, status: 'INACTIVE', purchasedAt: null, amountPaise: null, branchesIncluded: 1, prioritySupport: false },
        renewal: { status: 'INACTIVE', nextDue: null, isPastDue: false },
        credits: { balance: 0, monthlyGrant: 10000, yearlyLimit: 120000, used: 0, yearlyUsed: 0, monthlyUsed: 0, remaining: 0, remainingYearly: 120000, remainingMonthly: 10000 },
      });
    } catch (error) {
      // Silently fail - always set default inactive status instead of error
      console.warn("Subscription status fetch failed (non-fatal):", error);
      setStatus({
        plan: { name: null, status: 'INACTIVE', purchasedAt: null, amountPaise: null, branchesIncluded: 1, prioritySupport: false },
        renewal: { status: 'INACTIVE', nextDue: null, isPastDue: false },
        credits: { balance: 0, monthlyGrant: 10000, yearlyLimit: 120000, used: 0, yearlyUsed: 0, monthlyUsed: 0, remaining: 0, remainingYearly: 120000, remainingMonthly: 10000 },
      });
    }
  }, []);

  useEffect(() => {
    // Only run on client side
    if (typeof window !== "undefined") {
      refresh();
    }
  }, [refresh]);

  const value = useMemo(() => ({ status, refresh }), [status]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
