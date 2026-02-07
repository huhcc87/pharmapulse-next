export async function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  // Only run on client side - return a rejected promise for SSR
  if (typeof window === "undefined") {
    return Promise.reject(new Error("apiFetch can only be used on the client side"));
  }
  
  const res = await fetch(input, init);
  
  if (res.status === 402 && typeof window !== "undefined") {
    try {
      const detail = await res.json().catch(() => ({}));
      window.dispatchEvent(new CustomEvent("subscription-expired", { detail }));
    } catch (e) {
      // If JSON parsing fails, still dispatch event with empty detail
      window.dispatchEvent(new CustomEvent("subscription-expired", { detail: {} }));
    }
  }
  return res;
}
  