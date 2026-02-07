/**
 * Platform Detection Utilities
 * 
 * Detects platform (macOS vs Windows/Linux) for keyboard shortcuts
 */

/**
 * Detect if running on macOS
 */
export function isMac(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Modern way (if available)
  if ('userAgentData' in navigator && (navigator as any).userAgentData) {
    return (navigator as any).userAgentData.platform === 'macOS';
  }
  
  // Fallback to user agent
  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();
  
  return (
    platform.includes('mac') ||
    userAgent.includes('mac') ||
    platform === 'iphone' ||
    platform === 'ipad' ||
    platform === 'ipod'
  );
}

/**
 * Get the modifier key label for display
 */
export function getModKeyLabel(): string {
  return isMac() ? '⌘' : 'Ctrl';
}

/**
 * Get the Alt/Option key label for display
 */
export function getAltKeyLabel(): string {
  return isMac() ? '⌥' : 'Alt';
}

/**
 * Get the Shift key label for display
 */
export function getShiftKeyLabel(): string {
  return '⇧';
}

/**
 * Convert shortcut keys to platform-specific display string
 * e.g., ['mod', 'k'] -> "⌘K" (Mac) or "Ctrl+K" (Windows)
 */
export function formatShortcutDisplay(keys: string[]): string {
  const isMacOS = isMac();
  
  return keys.map(key => {
    const lowerKey = key.toLowerCase();
    
    if (lowerKey === 'mod' || lowerKey === 'cmd') {
      return isMacOS ? '⌘' : 'Ctrl';
    }
    if (lowerKey === 'alt' || lowerKey === 'option') {
      return isMacOS ? '⌥' : 'Alt';
    }
    if (lowerKey === 'shift') {
      return '⇧';
    }
    if (lowerKey === 'ctrl') {
      return 'Ctrl';
    }
    if (lowerKey === 'meta') {
      return isMacOS ? '⌘' : 'Meta';
    }
    if (lowerKey === 'enter' || lowerKey === 'return') {
      return '↵';
    }
    if (lowerKey === 'escape' || lowerKey === 'esc') {
      return 'Esc';
    }
    if (lowerKey === 'backspace' || lowerKey === 'delete') {
      return '⌫';
    }
    if (lowerKey === 'space') {
      return 'Space';
    }
    
    // Function keys
    if (lowerKey.startsWith('f') && /^f\d+$/.test(lowerKey)) {
      return key.toUpperCase();
    }
    
    // Special keys with symbols
    if (lowerKey === '+') return '+';
    if (lowerKey === '-') return '-';
    if (lowerKey === '*') return '*';
    if (lowerKey === '/') return '/';
    
    // Regular keys - capitalize for display
    return key.toUpperCase();
  }).join(isMacOS ? '' : '+');
}

/**
 * Check if key is a modifier key
 */
export function isModifierKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return ['mod', 'cmd', 'ctrl', 'meta', 'shift', 'alt', 'option'].includes(lowerKey);
}

/**
 * Normalize key string for comparison
 */
export function normalizeKey(key: string): string {
  const lowerKey = key.toLowerCase();
  
  // Map platform-specific keys
  if (lowerKey === 'meta' || lowerKey === 'cmd') {
    return 'mod';
  }
  if (lowerKey === 'option') {
    return 'alt';
  }
  if (lowerKey === 'return') {
    return 'enter';
  }
  
  return lowerKey;
}

/**
 * Check if event matches shortcut pattern
 */
export function matchesShortcut(
  event: KeyboardEvent,
  keys: string[]
): boolean {
  const pressed: string[] = [];
  
  // Check modifiers
  if (isMac()) {
    if (event.metaKey) pressed.push('mod');
  } else {
    if (event.ctrlKey) pressed.push('mod');
  }
  
  if (event.shiftKey) pressed.push('shift');
  if (event.altKey) pressed.push('alt');
  
  // Normalize main key
  const mainKey = normalizeKey(event.key);
  
  // Handle special keys
  if (mainKey === 'backspace') {
    // Check if it's delete key (different from backspace)
    if (event.key === 'Delete') {
      pressed.push('delete');
    } else {
      pressed.push('backspace');
    }
  } else if (!isModifierKey(mainKey)) {
    // Don't add modifier if it's the main key
    pressed.push(mainKey);
  }
  
  // Normalize expected keys
  const expectedKeys = keys.map(k => normalizeKey(k)).sort();
  const pressedKeys = pressed.sort();
  
  // Check if all expected keys are pressed
  if (expectedKeys.length !== pressedKeys.length) {
    return false;
  }
  
  // Compare arrays - both must have the same length and same keys
  if (expectedKeys.length !== pressedKeys.length) {
    return false;
  }
  
  // Sort both arrays for consistent comparison
  const sortedExpected = [...expectedKeys].sort();
  const sortedPressed = [...pressedKeys].sort();
  
  // Check if all keys match in order
  return sortedExpected.every((key, index) => key === sortedPressed[index]);
}
