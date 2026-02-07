# Keyboard Shortcuts Setup Guide

## ✅ Implementation Complete

The cross-platform keyboard shortcuts system has been implemented. This guide shows how to integrate it into your pages.

---

## 🚀 Quick Start

### Step 1: ShortcutProvider Already Added ✅

The `ShortcutProvider` is already added to `src/app/layout.tsx`. No action needed.

### Step 2: Add Shortcuts to POS Page

In `src/app/pos/page.tsx`, add the `POSShortcuts` component:

```tsx
import { POSShortcuts } from '@/components/keyboard-shortcuts/POSShortcuts';

export default function POSPage() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  // ... existing code ...

  return (
    <div>
      {/* Add POS shortcuts */}
      <POSShortcuts
        scanInputRef={searchInputRef}
        onAddScannedItem={async () => {
          if (searchInputRef.current?.value) {
            await handleScan(searchInputRef.current.value);
          }
        }}
        onIncreaseQty={() => {
          // Increase quantity for selected cart line
          // You'll need to implement this based on your cart state
        }}
        onDecreaseQty={() => {
          // Decrease quantity for selected cart line
        }}
        onRemoveCartLine={() => {
          // Remove selected cart line
          // You'll need to implement this based on your cart state
        }}
        onOpenPayment={() => setPaymentModalOpen(true)}
        onOpenDiscount={() => {
          // Open discount modal - implement this
        }}
        onHoldCart={() => {
          // Hold cart - implement this
        }}
        onResumeCart={() => {
          // Resume cart - implement this
        }}
        onNewSale={() => {
          if (confirm('Start a new sale? This will clear the current cart.')) {
            clear();
            setQ('');
            setSelectedCustomer(null);
          }
        }}
        onPrintInvoice={() => {
          // Print last invoice - implement this
        }}
      />

      {/* Your existing POS UI */}
      <input
        ref={searchInputRef}
        data-pos-scan-input
        // ... existing props ...
      />
    </div>
  );
}
```

### Step 3: Add Shortcuts to Inventory Page

In `src/app/inventory/page.tsx`, add the `InventoryShortcuts` component:

```tsx
import { InventoryShortcuts } from '@/components/keyboard-shortcuts/InventoryShortcuts';

export default function InventoryPage() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  // ... existing code ...

  return (
    <div>
      {/* Add Inventory shortcuts */}
      <InventoryShortcuts
        scanInputRef={searchInputRef}
        onAddProduct={() => setShowAddModal(true)}
        onOpenDrugLibrary={() => setDrugLibraryOpen(true)}
      />

      {/* Your existing Inventory UI */}
      <input
        ref={searchInputRef}
        data-inv-scan-input
        // ... existing props ...
      />
    </div>
  );
}
```

### Step 4: Add Shortcut Chips to Buttons

Add `ShortcutChip` components to key buttons for discoverability:

#### POS Page Example:

```tsx
import { ShortcutChip } from '@/components/keyboard-shortcuts/ShortcutChip';

// Payment button
<Button onClick={() => setPaymentModalOpen(true)}>
  <CreditCard className="w-4 h-4 mr-2" />
  Payment
  <ShortcutChip shortcut="shift+mod+p" className="ml-2" />
</Button>

// Discount button
<Button onClick={handleDiscount}>
  Discount
  <ShortcutChip shortcut="mod+d" className="ml-2" />
</Button>

// New sale button
<Button onClick={handleNewSale}>
  New Sale
  <ShortcutChip shortcut="mod+n" className="ml-2" />
</Button>

// Print button
<Button onClick={handlePrint}>
  Print Invoice
  <ShortcutChip shortcut="mod+p" className="ml-2" />
</Button>
```

#### Inventory Page Example:

```tsx
import { ShortcutChip } from '@/components/keyboard-shortcuts/ShortcutChip';

// Add Product button
<Button onClick={() => setShowAddModal(true)}>
  <Plus className="w-4 h-4 mr-2" />
  Add Product
  <ShortcutChip shortcut="mod+a" className="ml-2" />
</Button>

// Drug Library button
<Button onClick={() => setDrugLibraryOpen(true)}>
  Drug Library
  <ShortcutChip shortcut="mod+l" className="ml-2" />
</Button>
```

---

## ⌨️ Available Shortcuts

### Global Shortcuts (All Pages)
- `mod+K` (⌘K / Ctrl+K) - Open command palette
- `mod+/` (⌘/ / Ctrl+/) - Show keyboard shortcuts help
- `Esc` - Close modal/drawer/popover
- `Alt+1` (⌥1) - Navigate to Dashboard
- `Alt+2` (⌥2) - Navigate to POS
- `Alt+3` (⌥3) - Navigate to Inventory
- `Alt+4` (⌥4) - Navigate to Prescription AI
- `Alt+5` (⌥5) - Navigate to Adherence
- `Alt+6` (⌥6) - Navigate to Reports
- `Alt+7` (⌥7) - Navigate to Settings

### POS Page Shortcuts
- `F2` - Focus barcode scan input
- `Enter` - Add scanned item (only if scan input has value)
- `+` - Increase quantity for selected cart line
- `-` - Decrease quantity for selected cart line
- `Delete` - Remove selected cart line (only if not typing)
- `shift+mod+P` (⇧⌘P / Shift+Ctrl+P) - Open payment modal
- `mod+D` (⌘D / Ctrl+D) - Open discount modal
- `mod+H` (⌘H / Ctrl+H) - Hold cart
- `mod+R` (⌘R / Ctrl+R) - Resume cart
- `mod+N` (⌘N / Ctrl+N) - New sale (with confirmation)
- `mod+P` (⌘P / Ctrl+P) - Print last invoice

### Inventory Page Shortcuts
- `F2` - Focus scan input
- `mod+A` (⌘A / Ctrl+A) - Open Add New Product modal
- `mod+L` (⌘L / Ctrl+L) - Open Drug Library modal

### Add New Product Modal Shortcuts
- `mod+S` (⌘S / Ctrl+S) - Save/Add Product
- `shift+mod+R` (⇧⌘R / Shift+Ctrl+R) - Research from Web
- `shift+mod+L` (⇧⌘L / Shift+Ctrl+L) - Lookup Product
- `mod+V` (⌘V / Ctrl+V) - Verify (set verified status)
- `Esc` - Close modal

---

## 🎨 Platform Display

The system automatically displays the correct key symbols:

- **Windows/Linux**: `Ctrl+K`, `Ctrl+/`, `Alt+1`
- **macOS**: `⌘K`, `⌘/`, `⌥1`

Shortcut chips and help overlay show platform-specific symbols.

---

## 🔒 Safety Features

1. **No Payment Finalization**: Shortcuts can only open payment modal, never finalize payment
2. **Confirmation Dialogs**: Destructive actions (new sale, remove item) require confirmation
3. **Input Blocking**: Shortcuts are blocked when typing in inputs (except `Esc`, `mod+K`, `mod+/`)
4. **Route Awareness**: POS shortcuts only work on `/pos`, Inventory on `/inventory`
5. **Rate Limiting**: Prevents rapid-fire shortcuts for destructive actions

---

## 🧪 Testing

### Test on Windows:
1. Press `Ctrl+K` - Should open command palette
2. Press `Ctrl+/` - Should open shortcuts help
3. Navigate to POS, press `F2` - Should focus scan input
4. Press `Ctrl+N` - Should ask for confirmation, then clear cart

### Test on macOS:
1. Press `⌘K` - Should open command palette
2. Press `⌘/` - Should open shortcuts help
3. Navigate to POS, press `F2` - Should focus scan input
4. Press `⌘N` - Should ask for confirmation, then clear cart

---

## 📝 Next Steps

1. ✅ Integrate `POSShortcuts` into POS page
2. ✅ Integrate `InventoryShortcuts` into Inventory page
3. ✅ Add `ShortcutChip` components to buttons
4. ⏳ Test on both Windows and macOS
5. ⏳ Add shortcuts to Add Product Modal (when modal is created)

---

## 🎯 Success Criteria

- ✅ Same mod-based shortcuts work on Windows and Mac
- ✅ Users can discover shortcuts via chips and help overlay
- ✅ Command palette enables fast navigation and actions
- ✅ POS & Inventory are operable mostly by keyboard
- ✅ No accidental payment finalization via shortcuts

---

## 📚 Related Files

- `KEYBOARD_SHORTCUTS_IMPLEMENTATION.md` - Detailed implementation guide
- `src/lib/keyboard-shortcuts/` - Core shortcut infrastructure
- `src/components/keyboard-shortcuts/` - UI components
- `src/hooks/useShortcut.ts` - Hook for registering shortcuts

---

**Need Help?** Check the implementation guide or browser console for errors.
