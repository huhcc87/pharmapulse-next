/**
 * Platform Shortcut Display Component
 * 
 * Displays shortcuts with platform-specific symbols
 * Automatically shows ⌘ on Mac and Ctrl on Windows
 */

'use client';

import React from 'react';
import { formatShortcutDisplay } from '@/lib/keyboard-shortcuts/platform';
import { parseShortcutString } from '@/lib/keyboard-shortcuts/utils';

interface PlatformShortcutDisplayProps {
  shortcut: string; // e.g., "mod+k" or "f2"
  className?: string;
  variant?: 'inline' | 'chip' | 'badge';
}

export function PlatformShortcutDisplay({ 
  shortcut, 
  className = '',
  variant = 'inline'
}: PlatformShortcutDisplayProps) {
  const keys = parseShortcutString(shortcut);
  const display = formatShortcutDisplay(keys);

  if (variant === 'chip') {
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

  if (variant === 'badge') {
    return (
      <span
        className={`
          inline-flex items-center px-2 py-1 rounded
          text-xs font-mono
          bg-gray-100 dark:bg-gray-700
          text-gray-700 dark:text-gray-300
          border border-gray-300 dark:border-gray-600
          ${className}
        `}
      >
        {display}
      </span>
    );
  }

  // Default inline
  return (
    <span className={`font-mono text-sm ${className}`}>
      {display}
    </span>
  );
}
