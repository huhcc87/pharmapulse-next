# Barcode Scanner Integration (PharmaPulse)

## Best setup (recommended)
Use a USB/Bluetooth HID scanner (keyboard wedge).
- It will “type” barcode digits + Enter.

## Implementation
- Hook: `src/hooks/useBarcodeScanner.ts`
- POS page: `src/app/pos/page.tsx`

Tuning:
- `timeoutMs` controls how fast keystrokes must be to count as a scan.
- Keep it around 30–80ms depending on your scanner.

Troubleshooting:
- If normal typing triggers scans → reduce sensitivity (lower timeoutMs) or increase minLength.
- If scans are missed → increase timeoutMs slightly.
