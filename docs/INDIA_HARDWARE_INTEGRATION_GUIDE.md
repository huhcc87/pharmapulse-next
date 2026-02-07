# India Hardware Integration Guide

## Barcode Scanner (USB/Bluetooth HID)

### Supported Scanners
- USB HID barcode scanners (keyboard wedge mode)
- Bluetooth HID scanners (keyboard mode)
- Works with most modern scanners

### Setup
1. **Connect Scanner**:
   - USB: Plug into computer USB port
   - Bluetooth: Pair with computer
   - No drivers required (uses HID standard)

2. **Configure Scanner** (if needed):
   - Mode: "HID Keyboard" or "Keyboard Wedge"
   - Suffix: Enter key (CR/LF)
   - Prefix: None
   - Inter-character delay: 0ms (default)

3. **Test Scanner**:
   - Open Notepad
   - Scan a barcode
   - Should see barcode text + Enter

### Integration
- Works automatically in POS page (`/pos`)
- Scanner input captured via `useBarcodeScanner` hook
- Detects rapid key input (typical of scanners)
- Ignores slow manual typing

### Troubleshooting
- **Not working**: Check scanner is in HID mode, not serial/COM port
- **Slow response**: Increase timeout in hook (default: 50ms)
- **Double scans**: Check scanner isn't sending duplicate Enter keys
- **Wrong input**: Verify scanner is connected (check Device Manager/System Settings)

## Thermal Receipt Printer (ESC/POS)

### Why Browser Print is Limited
- Browser print API lacks ESC/POS commands
- No cash drawer control
- Poor thermal printer formatting
- Cannot print labels (ZPL/EPL)

### Recommended Approach: Local Print Bridge

Design a small local service that:
1. Runs on POS computer (Node.js/Electron app)
2. Receives print jobs via HTTP/WebSocket
3. Sends ESC/POS commands to printer
4. Controls cash drawer via printer kick

### ESC/POS Commands (Example)
```
ESC @          // Initialize printer
ESC a 1        // Center align
ESC d 2        // Feed 2 lines
ESC m 0        // Open cash drawer (port 0)
```

### Print Bridge API (Proposed)
```typescript
POST http://localhost:9100/print
{
  "type": "receipt",
  "content": {
    "header": "PharmaPulse",
    "invoiceNo": "INV-20240101-0001",
    "items": [...],
    "totals": {...},
    "gst": {...}
  }
}
```

### Cash Drawer
- Connected via RJ-11/RJ-12 to printer
- Opens when printer receives drawer kick command
- Usually port 0 or 2 on ESC/POS printers

## UPI Integration

### Dynamic QR Codes
- Generate UPI QR with amount embedded
- Customer scans with UPI app
- Payment auto-confirmed

### UTR Capture
- After UPI payment, customer shares UTR (Unique Transaction Reference)
- Enter UTR in payment reference field
- Used for reconciliation

### Card Terminal Integration
- Physical card machines (Razorpay, Paytm, etc.)
- Capture transaction ID/authorization code
- Enter in payment reference field
- System only stores reference, doesn't process payments directly

## Label Printer (ZPL)

### Use Cases
- Product labels
- Batch labels
- Price tags

### Integration via Print Bridge
- Send ZPL commands to print bridge
- Print bridge routes to label printer
- Example ZPL: `^XA^FO50,50^FDProduct Name^FS^XZ`

## Recommended Hardware Stack (India)

### Basic Setup
- **Barcode Scanner**: Datalogic Gryphon or equivalent (₹3,000-5,000)
- **Thermal Printer**: Epson TM-T20 or Star TSP100 (₹8,000-12,000)
- **Cash Drawer**: RJ-11 compatible (₹2,000-3,000)
- **Computer**: Any Windows/Linux/Mac

### Advanced Setup
- **Label Printer**: Zebra ZD220 or TSC TTP-244 (₹15,000-25,000)
- **Customer Display**: 2-line VFD/LCD display (₹2,000-5,000)
- **Barcode Scanner**: 2D scanner (for QR codes) (₹5,000-8,000)

## Browser Print Fallback

If thermal printer not available:
1. Invoice opens in new window (`/pos/receipt/[id]`)
2. Browser print dialog appears automatically
3. User selects printer and prints
4. Works with any printer but formatting may vary

## Print Bridge Implementation (Future)

See `/docs/INDIA_INVOICE_RECEIPT_TEMPLATE.md` for print bridge design.

