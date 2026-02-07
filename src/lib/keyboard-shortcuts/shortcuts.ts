/**
 * Global Keyboard Shortcuts Configuration
 * 
 * Central registry of all keyboard shortcuts
 */

import { ShortcutConfig } from './types';

/**
 * Get global shortcuts (available everywhere)
 */
export function getGlobalShortcuts(
  onOpenCommandPalette: () => void,
  onOpenShortcutsHelp: () => void,
  onNavigate: (path: string) => void
): ShortcutConfig[] {
  return [
    {
      id: 'open-command-palette',
      keys: ['mod', 'k'],
      action: onOpenCommandPalette,
      description: 'Open command palette',
      category: 'global',
      allowInInput: true,
    },
    {
      id: 'open-shortcuts-help',
      keys: ['mod', '/'],
      action: onOpenShortcutsHelp,
      description: 'Show keyboard shortcuts',
      category: 'global',
      allowInInput: true,
    },
    {
      id: 'close-modal',
      keys: ['escape'],
      action: () => {
        // Close any open modals (handled by components)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('shortcut:close-modal'));
        }
      },
      description: 'Close modal/drawer/popover',
      category: 'global',
      allowInInput: true,
    },
    {
      id: 'navigate-dashboard',
      keys: ['alt', '1'],
      action: () => onNavigate('/dashboard'),
      description: 'Navigate to Dashboard',
      category: 'global',
    },
    {
      id: 'navigate-pos',
      keys: ['alt', '2'],
      action: () => onNavigate('/pos'),
      description: 'Navigate to POS',
      category: 'global',
    },
    {
      id: 'navigate-inventory',
      keys: ['alt', '3'],
      action: () => onNavigate('/inventory'),
      description: 'Navigate to Inventory',
      category: 'global',
    },
    {
      id: 'navigate-prescription-ai',
      keys: ['alt', '4'],
      action: () => onNavigate('/prescription-ai'),
      description: 'Navigate to Prescription AI',
      category: 'global',
    },
    {
      id: 'navigate-adherence',
      keys: ['alt', '5'],
      action: () => onNavigate('/adherence'),
      description: 'Navigate to Adherence',
      category: 'global',
    },
    {
      id: 'navigate-reports',
      keys: ['alt', '6'],
      action: () => onNavigate('/reports'),
      description: 'Navigate to Reports',
      category: 'global',
    },
    {
      id: 'navigate-settings',
      keys: ['alt', '7'],
      action: () => onNavigate('/settings'),
      description: 'Navigate to Settings',
      category: 'global',
    },
  ];
}

/**
 * Get POS-specific shortcuts
 */
export function getPosShortcuts(
  onFocusScan: () => void,
  onAddScannedItem: () => void,
  onIncreaseQty: () => void,
  onDecreaseQty: () => void,
  onRemoveCartLine: () => void,
  onOpenPayment: () => void,
  onOpenDiscount: () => void,
  onHoldCart: () => void,
  onResumeCart: () => void,
  onNewSale: () => void,
  onPrintInvoice: () => void
): ShortcutConfig[] {
  return [
    {
      id: 'pos-focus-scan',
      keys: ['f2'],
      action: onFocusScan,
      description: 'Focus barcode scan input',
      category: 'pos',
      route: '/pos',
    },
    {
      id: 'pos-add-scanned',
      keys: ['enter'],
      action: onAddScannedItem,
      description: 'Add scanned item',
      category: 'pos',
      route: '/pos',
    },
    {
      id: 'pos-increase-qty',
      keys: ['+'],
      action: onIncreaseQty,
      description: 'Increase quantity for selected cart line',
      category: 'pos',
      route: '/pos',
    },
    {
      id: 'pos-decrease-qty',
      keys: ['-'],
      action: onDecreaseQty,
      description: 'Decrease quantity for selected cart line',
      category: 'pos',
      route: '/pos',
    },
    {
      id: 'pos-remove-cart-line',
      keys: ['delete'],
      action: onRemoveCartLine,
      description: 'Remove selected cart line',
      category: 'pos',
      route: '/pos',
    },
    {
      id: 'pos-open-payment',
      keys: ['shift', 'mod', 'p'],
      action: onOpenPayment,
      description: 'Open payment modal',
      category: 'pos',
      route: '/pos',
    },
    {
      id: 'pos-open-discount',
      keys: ['mod', 'd'],
      action: onOpenDiscount,
      description: 'Open discount modal',
      category: 'pos',
      route: '/pos',
    },
    {
      id: 'pos-hold-cart',
      keys: ['mod', 'h'],
      action: onHoldCart,
      description: 'Hold cart',
      category: 'pos',
      route: '/pos',
    },
    {
      id: 'pos-resume-cart',
      keys: ['mod', 'r'],
      action: onResumeCart,
      description: 'Resume cart',
      category: 'pos',
      route: '/pos',
    },
    {
      id: 'pos-new-sale',
      keys: ['mod', 'n'],
      action: onNewSale,
      description: 'New sale (clear cart)',
      category: 'pos',
      route: '/pos',
    },
    {
      id: 'pos-print-invoice',
      keys: ['mod', 'p'],
      action: onPrintInvoice,
      description: 'Print last invoice',
      category: 'pos',
      route: '/pos',
    },
  ];
}

/**
 * Get Inventory-specific shortcuts
 */
export function getInventoryShortcuts(
  onFocusScan: () => void,
  onAddProduct: () => void,
  onOpenDrugLibrary: () => void
): ShortcutConfig[] {
  return [
    {
      id: 'inv-focus-scan',
      keys: ['f2'],
      action: onFocusScan,
      description: 'Focus scan input',
      category: 'inventory',
      route: '/inventory',
    },
    {
      id: 'inv-add-product',
      keys: ['mod', 'a'],
      action: onAddProduct,
      description: 'Open Add New Product modal',
      category: 'inventory',
      route: '/inventory',
    },
    {
      id: 'inv-open-drug-library',
      keys: ['mod', 'l'],
      action: onOpenDrugLibrary,
      description: 'Open Drug Library modal',
      category: 'inventory',
      route: '/inventory',
    },
  ];
}

/**
 * Get Add Product Modal shortcuts
 */
export function getAddProductModalShortcuts(
  onSave: () => void,
  onResearch: () => void,
  onLookup: () => void,
  onVerify: () => void,
  onClose: () => void
): ShortcutConfig[] {
  return [
    {
      id: 'modal-save-product',
      keys: ['mod', 's'],
      action: onSave,
      description: 'Save/Add Product',
      category: 'modal',
    },
    {
      id: 'modal-research',
      keys: ['shift', 'mod', 'r'],
      action: onResearch,
      description: 'Research from Web',
      category: 'modal',
    },
    {
      id: 'modal-lookup',
      keys: ['shift', 'mod', 'l'],
      action: onLookup,
      description: 'Lookup Product',
      category: 'modal',
    },
    {
      id: 'modal-verify',
      keys: ['mod', 'v'],
      action: onVerify,
      description: 'Verify (set verified status)',
      category: 'modal',
    },
    {
      id: 'modal-close',
      keys: ['escape'],
      action: onClose,
      description: 'Close modal',
      category: 'modal',
      allowInInput: true,
    },
  ];
}
