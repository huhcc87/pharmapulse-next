# India Invoice/Receipt Template

## Invoice Structure (GST-Compliant)

### Header
```
PHARMAPULSE
TAX INVOICE

Invoice No: INV-20240101-0001
Date: 01/01/2024
```

### Seller Details
```
[Seller Name]
GSTIN: 27AAAAA0000A1Z5
Address: [Full address]
State: Maharashtra (Code: 27)
```

### Buyer Details
**B2C**:
```
Buyer: [Customer Name]
Address: [Optional address]
```

**B2B**:
```
Buyer: [Business Name]
GSTIN: 29AAAAA0000B2Z6
Address: [Full address]
State: Karnataka (Code: 29)
```

### Invoice Items Table
```
Item          | HSN  | Qty | Rate    | Discount | Taxable | GST | Total
--------------|------|-----|--------|----------|---------|-----|--------
Product 1     | 3004 | 2   | ₹100.00| ₹0.00    | ₹200.00 | ₹24 | ₹224.00
Product 2     | 3004 | 1   | ₹50.00 | ₹5.00    | ₹45.00  | ₹5.40 | ₹50.40
```

### HSN Summary
```
HSN Code | GST% | Taxable Value | CGST | SGST | IGST
---------|------|---------------|------|------|------
3004     | 12%  | ₹245.00       | ₹14.70| ₹14.70| ₹0.00
```

### Totals
```
Subtotal (Taxable):    ₹245.00
GST Total:             ₹29.40
Round-off:             ₹0.40
------------------------
Grand Total:           ₹274.80
```

### Payment Details
```
Payment Method: Cash
Paid Amount: ₹274.80
```

### Footer
```
Terms & Conditions:
- Subject to jurisdiction of [City], [State]
- Goods once sold cannot be returned or exchanged
- E. & O.E.

Thank you for your business!
```

## Thermal Receipt Format (58mm/80mm)

### Layout (58mm width, ~32 characters)
```
================================
     PHARMAPULSE PHARMACY
       TAX INVOICE
================================
Invoice: INV-20240101-0001
Date: 01/01/2024 10:30 AM
--------------------------------
Seller GSTIN: 27AAAAA0000A1Z5
Buyer GSTIN: 29AAAAA0000B2Z6
Place of Supply: 29 (Karnataka)
--------------------------------
ITEM           QTY  RATE   AMT
--------------------------------
Product 1       2  ₹100  ₹200
HSN:3004 GST:12%
                
Product 2       1   ₹50   ₹50
HSN:3004 GST:12%
Discount:       -₹5
--------------------------------
Subtotal:            ₹245.00
GST (12%):           ₹29.40
Round-off:            ₹0.40
--------------------------------
GRAND TOTAL:         ₹274.80
--------------------------------
Payment: Cash
Paid: ₹274.80
--------------------------------
Thank you!
================================
```

## Browser Print Template

See `/pos/receipt/[id]` page for browser-printable invoice.

## Print Bridge Design (Recommended)

### Architecture
```
Browser (POS) → HTTP/WebSocket → Local Print Bridge → Thermal Printer
                                         ↓
                                   Cash Drawer
```

### Print Bridge API

**Endpoint**: `POST http://localhost:9100/print`

**Request**:
```json
{
  "type": "receipt",
  "invoice": {
    "number": "INV-20240101-0001",
    "date": "2024-01-01T10:30:00Z",
    "seller": {
      "name": "PharmaPulse Pharmacy",
      "gstin": "27AAAAA0000A1Z5",
      "stateCode": "27"
    },
    "buyer": {
      "name": "Customer Name",
      "gstin": "29AAAAA0000B2Z6",
      "stateCode": "29"
    },
    "items": [
      {
        "name": "Product 1",
        "hsn": "3004",
        "qty": 2,
        "rate": 100.00,
        "discount": 0,
        "taxable": 200.00,
        "gst": 24.00,
        "total": 224.00
      }
    ],
    "totals": {
      "subtotal": 245.00,
      "gst": 29.40,
      "roundOff": 0.40,
      "grandTotal": 274.80
    },
    "payment": {
      "method": "CASH",
      "amount": 274.80
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "jobId": "job-123",
  "printed": true
}
```

### Print Bridge Implementation (Node.js Example)

```javascript
const express = require('express');
const escpos = require('escpos');
const { USB } = require('escpos-usb');

const app = express();
app.use(express.json());

app.post('/print', async (req, res) => {
  const device = new USB();
  const printer = new escpos.Printer(device);

  try {
    await device.open();
    
    printer
      .font('A')
      .align('CT')
      .text('PHARMAPULSE PHARMACY')
      .text('TAX INVOICE')
      .text('---')
      .text(`Invoice: ${req.body.invoice.number}`)
      .text(`Date: ${new Date(req.body.invoice.date).toLocaleString()}`)
      .cut()
      .cashdraw(2); // Open cash drawer

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    device.close();
  }
});

app.listen(9100);
```

## ZPL Label Template (Future)

For product labels:
```
^XA
^FO50,50^A0N,30,30^FDProduct Name^FS
^FO50,100^A0N,25,25^FDMRP: ₹100^FS
^FO50,150^BY2^BCN,50,Y,N,N^FD123456789012^FS
^XZ
```

