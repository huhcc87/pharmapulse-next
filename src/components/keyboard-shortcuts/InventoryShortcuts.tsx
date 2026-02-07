/**
 * Inventory Keyboard Shortcuts Integration
 * 
 * Handles Inventory-specific keyboard shortcuts
 */

'use client';

import React, { useEffect } from 'react';
import { useShortcuts } from '@/lib/keyboard-shortcuts/ShortcutProvider';
import { getInventoryShortcuts } from '@/lib/keyboard-shortcuts/shortcuts';

interface InventoryShortcutsProps {
  scanInputRef: React.RefObject<HTMLInputElement>;
  onAddProduct: () => void;
  onOpenDrugLibrary: () => void;
}

export function InventoryShortcuts({
  scanInputRef,
  onAddProduct,
  onOpenDrugLibrary,
}: InventoryShortcutsProps) {
  const { registerShortcut } = useShortcuts();

  useEffect(() => {
    const unregisterFns = getInventoryShortcuts(
      () => {
        // Focus scan input
        scanInputRef.current?.focus();
        scanInputRef.current?.setAttribute('data-inv-scan-input', 'true');
      },
      () => {
        // Open Add New Product modal
        onAddProduct();
      },
      () => {
        // Open Drug Library modal
        onOpenDrugLibrary();
      }
    ).map(config => registerShortcut(config));

    return () => {
      unregisterFns.forEach(fn => fn());
    };
  }, [registerShortcut, scanInputRef, onAddProduct, onOpenDrugLibrary]);

  return null; // This component doesn't render anything
}
