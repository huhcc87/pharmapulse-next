"use client";

import { useEffect, useMemo, useState } from "react";

type GstinRow = {
  id: number;
  gstin: string;
  stateCode: string;
  isActive: boolean;
  invoicePrefix: string;
  nextInvoiceNo: number;
};

const LS_KEY = "pp_active_gstin_id";

export function useActiveGstin() {
  const [loading, setLoading] = useState(true);
  const [gstins, setGstins] = useState<GstinRow[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/gst/gstins", { cache: "no-store" });
      const data = await res.json();
      const rows: GstinRow[] = data.gstins ?? [];
      setGstins(rows);

      const saved = Number(localStorage.getItem(LS_KEY) ?? "");
      const fallback = rows[0]?.id ?? null;
      const resolved =
        rows.find((g) => g.id === saved)?.id ?? fallback;

      setActiveId(resolved);

      if (resolved) localStorage.setItem(LS_KEY, String(resolved));
      else localStorage.removeItem(LS_KEY);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const activeGstin = useMemo(
    () => gstins.find((g) => g.id === activeId) ?? null,
    [gstins, activeId]
  );

  function setActive(id: number) {
    setActiveId(id);
    localStorage.setItem(LS_KEY, String(id));
  }

  return {
    loading,
    gstins,
    activeId,
    activeGstin,
    hasGstins: gstins.length > 0,
    refresh,
    setActive,
  };
}
