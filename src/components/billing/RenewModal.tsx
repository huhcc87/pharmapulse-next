"use client";

import React, { useEffect, useState } from "react";

export function RenewModal() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const handler = (e: any) => {
      setDetail(e.detail);
      setOpen(true);
    };
    window.addEventListener("subscription-expired", handler);
    return () => window.removeEventListener("subscription-expired", handler);
  }, []);

  async function startCheckout() {
    const res = await fetch("/api/billing/create-checkout-session", { method: "POST" });
    const data = await res.json();
    if (data?.url) window.location.href = data.url;
  }

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 9999
    }}>
      <div style={{ background: "#fff", padding: 20, borderRadius: 12, width: 520, maxWidth: "92vw" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Subscription expired</h2>
        <p style={{ marginTop: 8 }}>
          Checkout and other write actions are disabled until you renew.
        </p>
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
          <div>Status: {detail?.status || "expired"}</div>
          <div>Period end: {detail?.period_end || "—"}</div>
          <div>Grace until: {detail?.grace_until || "—"}</div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={() => setOpen(false)} style={{ padding: "8px 12px" }}>
            Close
          </button>
          <button onClick={startCheckout} style={{ padding: "8px 12px", fontWeight: 700 }}>
            Renew now
          </button>
        </div>
      </div>
    </div>
  );
}
