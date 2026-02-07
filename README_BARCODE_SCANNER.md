# Datalogic Gryphon GBT4500 Barcode Scanner Integration

## Overview
The PharmaPulse application now supports the Datalogic Gryphon GBT4500 Cordless Healthcare Barcode Scanner Kit. The scanner works as a HID (Human Interface Device) keyboard, automatically typing scanned barcodes followed by Enter.

## How It Works

### Technical Implementation
1. **HID Keyboard Mode**: The scanner acts as a keyboard input device
2. **Auto-detection**: The application listens for rapid keyboard input (typical of barcode scanners)
3. **Enter Key Detection**: When Enter is pressed after rapid input, it's treated as a barcode scan
4. **Product Matching**: Scanned barcodes are matched against product database

### Features
- ✅ Automatic barcode detection
- ✅ Works in Inventory and POS pages
- ✅ Visual feedback when scanning
- ✅ Product search and highlighting
- ✅ Manual barcode entry support

## Usage Instructions

### Setup
1. **Connect the Scanner**:
   - Connect the Datalogic Gryphon GBT4500 to your computer via USB or Bluetooth
   - The scanner should be recognized as a keyboard device
   - No additional drivers needed (uses HID mode)

2. **Configure Scanner** (if needed):
   - Ensure scanner is in "Keyboard Wedge" or "HID Keyboard" mode
   - Default settings should work out of the box
   - Scanner should send Enter key after barcode

### Using in Inventory Page
1. Click the **"Scan"** button in the inventory page
2. A barcode scanner input field will appear
3. Point the scanner at a barcode and scan
4. The product will be automatically found and highlighted
5. If product not found, you'll be prompted to add it

### Using in POS Page
1. Open the POS Terminal page
2. The scanner is automatically active (look for "Scanner Ready" indicator)
3. Scan a product barcode
4. Product is automatically added to cart
5. Continue scanning to add more items

## Test Barcodes
For testing purposes, use these sample barcodes:
- `8901030861234` - Dolo 650
- `8901030861241` - Glycomet 500mg
- `8901030861258` - Paracetamol 500mg
- `8901030861265` - Azithromycin 500mg
- `8901030861272` - Cetirizine 10mg

## Troubleshooting

### Scanner Not Working
1. **Check Connection**: Ensure scanner is connected via USB/Bluetooth
2. **Test Scanner**: Try scanning in Notepad - you should see barcode appear
3. **Browser Focus**: Make sure the browser window is focused
4. **Input Field**: Ensure no input field is focused (scanner works globally)

### Barcode Not Found
1. **Check Barcode**: Verify the barcode exists in the product database
2. **Add Product**: Use "Add Product" button to add new products with barcodes
3. **Manual Entry**: You can also type barcode manually in the search field

### Scanner Typing Too Fast
- The application handles rapid input automatically
- If issues occur, check scanner settings for "Typing Speed" or "Inter-character Delay"

## Technical Details

### Barcode Scanner Hook
Located in: `src/hooks/useBarcodeScanner.ts`
- Detects rapid keyboard input
- Times out after 100ms of no input
- Triggers callback when Enter is pressed

### Barcode Scanner Component
Located in: `src/components/BarcodeScanner.tsx`
- Visual input field for barcode scanning
- Shows scanning status
- Supports manual entry

### Integration Points
- **Inventory Page**: `src/app/inventory/page.tsx`
- **POS Page**: `src/app/pos/page.tsx`

## Scanner Configuration (Advanced)

If you need to configure the scanner, refer to Datalogic documentation:
- Default mode: HID Keyboard
- Suffix: Enter key (CR)
- Prefix: None
- Inter-character delay: 0ms (default)

## Support
For issues with the scanner hardware, refer to Datalogic support.
For application integration issues, check the browser console for error messages.

