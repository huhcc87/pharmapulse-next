/**
 * Shortcuts Help Button
 *
 * Button to open keyboard shortcuts help overlay
 * Can be placed in header, sidebar, or anywhere in the app
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Keyboard } from 'lucide-react';
import { ShortcutsHelpOverlay } from './ShortcutsHelpOverlay';
import { Button } from '@/components/ui/button';
import { useShortcut } from '@/hooks/useShortcut';
import { isMac } from '@/lib/keyboard-shortcuts/platform';

type ButtonVariant = 'default' | 'outline' | 'ghost';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';
type LegacySize = ButtonSize | 'md';

interface ShortcutsHelpButtonProps {
  variant?: ButtonVariant;
  size?: LegacySize;
  showIcon?: boolean;
  className?: string;
}

export function ShortcutsHelpButton({
  variant = 'ghost',
  size = 'sm',
  showIcon = true,
  className = '',
}: ShortcutsHelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [modKey, setModKey] = useState<string>('Ctrl'); // Default to avoid hydration mismatch

  // Normalize legacy size -> shadcn Button size
  const normalizedSize: ButtonSize = size === 'md' ? 'default' : size;

  // Set mod key on client side only to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setModKey(isMac() ? '⌘' : 'Ctrl');
    }
  }, []);

  // Register shortcut to open help
  useShortcut({
    id: 'open-shortcuts-help-button',
    keys: ['mod', '/'],
    action: () => setIsOpen(true),
    description: 'Open keyboard shortcuts help',
    category: 'global',
    allowInInput: true,
  });

  return (
    <>
      <Button
        variant={variant}
        size={normalizedSize}
        onClick={() => setIsOpen(true)}
        className={className}
        title={`Keyboard Shortcuts (${modKey}+/)`}
      >
        {showIcon && <Keyboard className="w-4 h-4 mr-2" />}
        <span className="hidden sm:inline">Shortcuts</span>
        <span className="sm:hidden">⌨️</span>
      </Button>

      <ShortcutsHelpOverlay isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
