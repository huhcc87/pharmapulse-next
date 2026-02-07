/**
 * Keyboard Shortcuts Utilities
 * 
 * Helper functions for keyboard shortcut handling
 */

import { isModifierKey, normalizeKey } from './platform';

/**
 * Check if user is typing in an input field
 */
export function isTypingInInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  
  const tagName = target.tagName.toLowerCase();
  const isInput = tagName === 'input';
  const isTextarea = tagName === 'textarea';
  const isSelect = tagName === 'select';
  const isContentEditable = target.contentEditable === 'true';
  
  // Check input types
  if (isInput) {
    const input = target as HTMLInputElement;
    const type = input.type?.toLowerCase();
    
    // Allow shortcuts in these input types
    if (['checkbox', 'radio', 'button', 'submit', 'reset'].includes(type)) {
      return false;
    }
  }
  
  return isInput || isTextarea || isSelect || isContentEditable;
}

/**
 * Check if a key combination should be allowed while typing
 */
export function shouldAllowInInput(keys: string[]): boolean {
  const normalizedKeys = keys.map(k => normalizeKey(k));
  
  // Always allow these shortcuts even when typing
  const allowedInInput = [
    ['escape', 'esc'],
    ['mod', 'k'],
    ['mod', '/'],
  ];
  
  return allowedInInput.some(allowed => {
    if (allowed.length !== normalizedKeys.length) return false;
    return allowed.every((key, index) => key === normalizedKeys[index]);
  });
}

/**
 * Parse shortcut string to array of keys
 * e.g., "mod+k" -> ["mod", "k"]
 */
export function parseShortcutString(shortcut: string): string[] {
  return shortcut
    .toLowerCase()
    .split('+')
    .map(key => key.trim())
    .filter(Boolean);
}

/**
 * Check if event target is an input/textarea/select
 */
export function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  
  const tagName = target.tagName.toLowerCase();
  const isInput = tagName === 'input';
  const isTextarea = tagName === 'textarea';
  const isSelect = tagName === 'select';
  const isContentEditable = target.contentEditable === 'true';
  
  // Check input types that should block shortcuts
  if (isInput) {
    const input = target as HTMLInputElement;
    const type = input.type?.toLowerCase();
    
    // Allow shortcuts in these input types
    if (['checkbox', 'radio', 'button', 'submit', 'reset', 'file'].includes(type)) {
      return false;
    }
  }
  
  return isInput || isTextarea || isSelect || isContentEditable;
}

/**
 * Create a key string from array
 * e.g., ["mod", "k"] -> "mod+k"
 */
export function createShortcutString(keys: string[]): string {
  return keys.map(k => normalizeKey(k)).join('+');
}

/**
 * Debounce function to prevent rapid-fire shortcuts
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function to limit shortcut frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
