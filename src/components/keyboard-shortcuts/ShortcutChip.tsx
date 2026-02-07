/**
 * Shortcut Chip Component
 * 
 * Small, non-intrusive display of keyboard shortcuts on buttons
 */

'use client';

import React from 'react';
import { formatShortcutDisplay } from '@/lib/keyboard-shortcuts/platform';
import { parseShortcutString } from '@/lib/keyboard-shortcuts/utils';

interface ShortcutChipProps {
  shortcut: string; // e.g., "mod+k" or "f2"
  className?: string;
}

export function ShortcutChip({ shortcut, className = '' }: ShortcutChipProps) {
  const keys = parseShortcutString(shortcut);
  const display = formatShortcutDisplay(keys);

  return (
    <kbd
      className={`
        inline-flex items-center justify-center
        px-2 py-1
        text-xs font-mono
        bg-gray-100 dark:bg-gray-700
        text-gray-600 dark:text-gray-400
        border border-gray-300 dark:border-gray-600
        rounded
        shadow-sm
        ${className}
      `}
      title={`Shortcut: ${display}`}
    >
      {display}
    </kbd>
  );
}
