/**
 * Razorpay Checkout Utility
 * 
 * Dynamically loads Razorpay checkout script and opens payment modal
 */

declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    email?: string;
    name?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void | Promise<void>;
  modal?: {
    ondismiss?: () => void;
  };
}

/**
 * Load Razorpay checkout script dynamically
 */
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.Razorpay) {
      resolve();
      return;
    }
    
    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Razorpay script')));
      return;
    }
    
    // Load script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay script'));
    document.body.appendChild(script);
  });
}

/**
 * Open Razorpay checkout
 */
export async function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<void> {
  try {
    // Load Razorpay script
    await loadRazorpayScript();
    
    // Wait a bit for Razorpay to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (!window.Razorpay) {
      throw new Error('Razorpay SDK not loaded');
    }
    
    // Create Razorpay instance
    const razorpay = new window.Razorpay({
      key: options.key,
      amount: options.amount,
      currency: options.currency,
      name: options.name,
      description: options.description,
      order_id: options.order_id,
      prefill: options.prefill || {},
      theme: options.theme || { color: '#10b981' }, // Default teal color
      handler: options.handler,
      modal: {
        ondismiss: options.modal?.ondismiss || (() => {
          console.log('Payment modal closed');
        }),
      },
    });
    
    // Open checkout
    razorpay.open();
    
  } catch (error: any) {
    console.error('Razorpay checkout error:', error);
    throw new Error(`Failed to open payment: ${error.message}`);
  }
}
