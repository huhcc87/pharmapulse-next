/**
 * POS Keyboard Shortcuts Integration
 * 
 * Handles POS-specific keyboard shortcuts
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { useShortcuts } from '@/lib/keyboard-shortcuts/ShortcutProvider';
import { getPosShortcuts } from '@/lib/keyboard-shortcuts/shortcuts';

interface POSShortcutsProps {
  scanInputRef: React.RefObject<HTMLInputElement>;
  onAddScannedItem: () => void;
  onIncreaseQty: () => void;
  onDecreaseQty: () => void;
  onRemoveCartLine: () => void;
  onOpenPayment: () => void;
  onOpenDiscount: () => void;
  onHoldCart: () => void;
  onResumeCart: () => void;
  onNewSale: () => void;
  onPrintInvoice: () => void;
}

export function POSShortcuts({
  scanInputRef,
  onAddScannedItem,
  onIncreaseQty,
  onDecreaseQty,
  onRemoveCartLine,
  onOpenPayment,
  onOpenDiscount,
  onHoldCart,
  onResumeCart,
  onNewSale,
  onPrintInvoice,
}: POSShortcutsProps) {
  const { registerShortcut } = useShortcuts();

  useEffect(() => {
    const unregisterFns = getPosShortcuts(
      () => {
        // Focus scan input
        scanInputRef.current?.focus();
        scanInputRef.current?.setAttribute('data-pos-scan-input', 'true');
      },
      () => {
        // Add scanned item (only if input has value)
        const input = scanInputRef.current;
        if (input && input.value.trim()) {
          onAddScannedItem();
        }
      },
      () => {
        // Increase quantity for selected cart line
        onIncreaseQty();
      },
      () => {
        // Decrease quantity for selected cart line
        onDecreaseQty();
      },
      () => {
        // Remove selected cart line (only if not typing)
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          return; // Don't remove if typing
        }
        onRemoveCartLine();
      },
      () => {
        // Open payment modal (DO NOT finalize payment)
        onOpenPayment();
      },
      () => {
        // Open discount modal
        onOpenDiscount();
      },
      () => {
        // Hold cart
        onHoldCart();
      },
      () => {
        // Resume cart
        onResumeCart();
      },
      () => {
        // New sale (with confirmation)
        if (confirm('Start a new sale? This will clear the current cart.')) {
          onNewSale();
        }
      },
      () => {
        // Print last invoice
        onPrintInvoice();
      }
    ).map(config => registerShortcut(config));

    return () => {
      unregisterFns.forEach(fn => fn());
    };
  }, [
    registerShortcut,
    scanInputRef,
    onAddScannedItem,
    onIncreaseQty,
    onDecreaseQty,
    onRemoveCartLine,
    onOpenPayment,
    onOpenDiscount,
    onHoldCart,
    onResumeCart,
    onNewSale,
    onPrintInvoice,
  ]);

  return null; // This component doesn't render anything
}
