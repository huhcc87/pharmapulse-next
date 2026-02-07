// Pure helper functions for dashboard metrics calculations
// These can be used in multiple places if needed

export function formatCurrency(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function formatCurrencyDecimal(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export function getRiskScoreColor(score: number): string {
  if (score < 30) return "bg-green-100 text-green-800 border-green-200";
  if (score < 60) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-red-100 text-red-800 border-red-200";
}

export function getRiskScoreLabel(score: number): string {
  if (score < 30) return "Low Risk";
  if (score < 60) return "Medium Risk";
  return "High Risk";
}

export function getSeverityIcon(severity: "info" | "warn" | "critical"): string {
  switch (severity) {
    case "critical":
      return "🔴";
    case "warn":
      return "🟡";
    case "info":
      return "ℹ️";
  }
}

export function getSeverityColor(severity: "info" | "warn" | "critical"): string {
  switch (severity) {
    case "critical":
      return "text-red-600";
    case "warn":
      return "text-yellow-600";
    case "info":
      return "text-blue-600";
  }
}

export function calculateScanSuccessRate(success: number, fail: number): number {
  const total = success + fail;
  if (total === 0) return 0;
  return Math.round((success / total) * 100);
}






