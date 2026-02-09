"use client";

import React, { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";

type Props = {
  payeeVpa: string; // example: "yourstore@upi"
  payeeName: string; // example: "PharmaPulse Store"
  amount: number;
  note?: string;
};

export function buildUpiUri(p: Props) {
  const params = new URLSearchParams();
  params.set("pa", p.payeeVpa);
  params.set("pn", p.payeeName);
  params.set("am", p.amount.toFixed(2));
  params.set("cu", "INR");
  if (p.note) params.set("tn", p.note);
  return `upi://pay?${params.toString()}`;
}

export function UpiQr(props: Props) {
  const uri = useMemo(() => buildUpiUri(props), [
    props.payeeVpa,
    props.payeeName,
    props.amount,
    props.note,
  ]);

  // Basic guard (avoid rendering broken/empty QR)
  if (!props.payeeVpa || !props.payeeName || !Number.isFinite(props.amount)) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-md border bg-white p-2">
        <QRCodeSVG value={uri} size={220} marginSize={1} />
      </div>

      <div className="text-xs text-slate-600 break-all text-center max-w-[260px]">
        {uri}
      </div>
    </div>
  );
}
