"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

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
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    const uri = buildUpiUri(props);
    QRCode.toDataURL(uri, { margin: 1, width: 220 })
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [props.payeeVpa, props.payeeName, props.amount, props.note]);

  if (!dataUrl) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <img src={dataUrl} alt="UPI QR" className="rounded-md border" />
      <div className="text-xs text-slate-600 break-all">
        {buildUpiUri(props)}
      </div>
    </div>
  );
}
