# India Market Enhancement Recommendations
## Comprehensive Feature Suggestions for Indian Pharmacy Market

**Date:** January 2026  
**Current Status:** Good foundation with GST, POS, and inventory management  
**Market Focus:** Indian retail pharmacies, distributors, and wholesalers

---

## 🔴 CRITICAL PRIORITY (GST & Compliance)

### 1. E-Invoice Integration (NIC API)
**Status:** ⚠️ Structure exists, API integration missing  
**Priority:** HIGH - Required for businesses with >5 Cr turnover

**What's Needed:**
- [ ] Integrate with NIC e-Invoice Portal API (`https://einvoice.gst.gov.in`)
- [ ] Generate IRN (Invoice Registration Number) automatically
- [ ] Store IRN and QR code on invoice
- [ ] Handle e-Invoice cancellation scenarios
- [ ] Bulk e-Invoice generation for existing invoices
- [ ] Retry logic for API failures

**Implementation:**
- API endpoint: `/api/invoices/[id]/e-invoice/generate`
- Store IRN in `Invoice.eInvoiceIrn` field (add to schema)
- Store QR code in `Invoice.eInvoiceQrCode` field

### 2. E-Way Bill Generation
**Status:** ❌ Not implemented  
**Priority:** HIGH - Required for inter-state movement >₹50,000

**What's Needed:**
- [ ] E-Way Bill generation API integration (`https://ewaybillgst.gov.in`)
- [ ] Auto-generate e-Way Bill for inter-state invoices >₹50,000
- [ ] E-Way Bill number display on invoice
- [ ] E-Way Bill cancellation
- [ ] Vehicle number and transporter GSTIN capture
- [ ] Distance calculation for e-Way Bill

**Schema Addition:**
```prisma
model Invoice {
  eWayBillNumber      String?
  eWayBillValidUpto   DateTime?
  transporterGstin    String?
  vehicleNumber       String?
  distance            Int? // in km
}
```

### 3. TCS (Tax Collected at Source)
**Status:** ❌ Not implemented  
**Priority:** MEDIUM - Required for B2B sales >₹50L annually

**What's Needed:**
- [ ] TCS calculation (1% for non-GST registered, 0.1% for GST registered)
- [ ] TCS fields in invoice line items
- [ ] TCS summary in GSTR-1 export
- [ ] TCS certificate generation (Form 27D)
- [ ] TCS ledger tracking

### 4. Credit Note / Return Note with GST Reversal
**Status:** ⚠️ Partial (return models exist)  
**Priority:** HIGH - Essential for returns/refunds

**What's Needed:**
- [ ] Credit Note generation from return/exchange
- [ ] GST reversal calculation (CGST/SGST/IGST)
- [ ] Link credit note to original invoice
- [ ] Credit note number series
- [ ] Include credit notes in GSTR-1
- [ ] Debit Note support for additional charges

**Schema Addition:**
```prisma
model CreditNote {
  creditNoteNumber     String  @unique
  invoiceId            Int
  invoice              Invoice @relation(fields: [invoiceId], references: [id])
  reason               String
  totalAmountPaise     Int
  cgstPaise            Int
  sgstPaise            Int
  igstPaise            Int
  createdAt            DateTime @default(now())
  // ... other fields
}
```

### 5. Cash Memo for Small B2C Sales
**Status:** ❌ Not implemented  
**Priority:** MEDIUM - Common in Indian retail

**What's Needed:**
- [ ] Option to generate cash memo (non-GST invoice) for B2C <₹200
- [ ] Simplified invoice template without GST fields
- [ ] Cash memo number series
- [ ] Toggle between Tax Invoice and Cash Memo

---

## 🟠 HIGH PRIORITY (Regulatory Compliance)

### 6. Schedule H/H1 Drug Compliance
**Status:** ⚠️ Schema has `isScheduleDrug` flag, but no enforcement  
**Priority:** HIGH - Legal requirement

**What's Needed:**
- [ ] Block sale of Schedule H drugs without prescription
- [ ] Prescription validation UI at POS
- [ ] Schedule H warning banner on drug search
- [ ] Prescription expiry check (validity period)
- [ ] Prescription tracking for Schedule H drugs
- [ ] Audit log for Schedule H sales
- [ ] Doctor name and license number capture

**Implementation:**
- Validation in `/api/pos/checkout` route
- UI warning in POS when adding Schedule H drug
- Prescription upload/scan requirement

### 7. Prescription Digitization (NPPD Standards)
**Status:** ⚠️ Models exist, but not NPPD compliant  
**Priority:** MEDIUM - Future regulatory requirement

**What's Needed:**
- [ ] NPPD (National Prescription Platform) format support
- [ ] Prescription validation against NPPD
- [ ] Digital prescription storage
- [ ] Prescription refill tracking
- [ ] Prescription history per patient

### 8. Age Verification for Restricted Medicines
**Status:** ❌ Not implemented  
**Priority:** MEDIUM - Legal requirement for certain drugs

**What's Needed:**
- [ ] Age verification prompt at POS
- [ ] ID verification (Aadhaar/PAN)
- [ ] Age restriction flags in drug library
- [ ] Audit log for age-restricted sales
- [ ] ID document scan/upload

### 9. Digital Signature for Invoices
**Status:** ❌ Not implemented  
**Priority:** MEDIUM - Enhanced authenticity

**What's Needed:**
- [ ] Digital signature integration (Class 2/Class 3)
- [ ] DSC certificate management
- [ ] Signed PDF invoice generation
- [ ] Signature verification API

---

## 🟡 MEDIUM PRIORITY (Operational Features)

### 10. WhatsApp Order Integration
**Status:** ❌ Not implemented  
**Priority:** HIGH - Very popular in Indian market

**What's Needed:**
- [ ] WhatsApp Business API integration
- [ ] Order placement via WhatsApp
- [ ] Order confirmation via WhatsApp
- [ ] Invoice sharing via WhatsApp
- [ ] Automated reminders (prescription refills, stock alerts)
- [ ] WhatsApp customer support chatbot

**Implementation:**
- Use WhatsApp Business Cloud API or Twilio
- Webhook endpoint: `/api/whatsapp/webhook`
- Order processing: `/api/whatsapp/orders/create`

### 11. SMS/WhatsApp Notifications
**Status:** ❌ Not implemented  
**Priority:** HIGH - Customer engagement

**What's Needed:**
- [ ] SMS service integration (Twilio/AWS SNS/TextLocal)
- [ ] Order confirmation SMS
- [ ] Prescription refill reminders
- [ ] Stock arrival notifications
- [ ] Birthday/anniversary offers
- [ ] Payment reminders for credit customers

### 12. Multi-Lingual Support
**Status:** ❌ Not implemented  
**Priority:** MEDIUM - Important for regional reach

**What's Needed:**
- [ ] Hindi translation (priority)
- [ ] Regional languages (Tamil, Telugu, Marathi, Bengali, Gujarati, Kannada)
- [ ] Language switcher in UI
- [ ] Invoice printing in selected language
- [ ] SMS/WhatsApp messages in customer's language

**Implementation:**
- Use `next-intl` or `react-i18next`
- Translation files: `src/locales/hi.json`, `src/locales/ta.json`, etc.

### 13. Discount Coupons / Vouchers System
**Status:** ❌ Not implemented  
**Priority:** MEDIUM - Common marketing tool

**What's Needed:**
- [ ] Coupon code generation
- [ ] Percentage and fixed amount discounts
- [ ] Validity period and usage limits
- [ ] Customer-specific coupons
- [ ] Minimum purchase amount requirement
- [ ] Coupon usage tracking

**Schema Addition:**
```prisma
model Coupon {
  code                String  @unique
  discountType        String // PERCENTAGE, FIXED
  discountValue       Int
  minPurchasePaise    Int?
  validFrom           DateTime
  validUntil          DateTime
  maxUses             Int?
  usedCount           Int     @default(0)
  isActive            Boolean @default(true)
}
```

### 14. Stock Transfer Note (STN) for Multi-Branch
**Status:** ❌ Not implemented  
**Priority:** MEDIUM - Required for chain pharmacies

**What's Needed:**
- [ ] Stock transfer between branches
- [ ] STN generation with GST impact
- [ ] Transfer approval workflow
- [ ] Stock reconciliation
- [ ] Transfer cost tracking

### 15. Purchase Return Management
**Status:** ⚠️ Partial  
**Priority:** MEDIUM - Common operation

**What's Needed:**
- [ ] Purchase return note generation
- [ ] GST reversal on purchase returns
- [ ] Return to vendor workflow
- [ ] Credit note from vendor
- [ ] Return reason tracking

### 16. Vendor Management with GST
**Status:** ⚠️ Partial  
**Priority:** MEDIUM - Essential for procurement

**What's Needed:**
- [ ] Vendor GSTIN validation
- [ ] Vendor payment tracking
- [ ] Purchase order to vendor
- [ ] Vendor performance analytics
- [ ] Rate contract management per vendor

### 17. Rate Contract Management
**Status:** ❌ Not implemented  
**Priority:** MEDIUM - Common in pharma procurement

**What's Needed:**
- [ ] Rate contract creation (vendor, drug, price, validity)
- [ ] Auto-apply rate contract prices in PO
- [ ] Rate contract expiry alerts
- [ ] Price comparison across vendors
- [ ] Contract negotiation history

### 18. Delivery Tracking
**Status:** ❌ Not implemented  
**Priority:** LOW - For online/home delivery

**What's Needed:**
- [ ] Order tracking page
- [ ] Delivery status updates
- [ ] Delivery partner integration
- [ ] OTP-based delivery confirmation
- [ ] Delivery proof upload

### 19. Daily/Weekly Reports for Pharmacy Owners
**Status:** ⚠️ Basic reports exist  
**Priority:** HIGH - Business intelligence

**What's Needed:**
- [ ] Daily sales summary (cash, card, UPI, credit)
- [ ] Top-selling products report
- [ ] Low stock alerts dashboard
- [ ] Expiry tracking dashboard (90/60/30 days)
- [ ] Customer analytics (new vs returning)
- [ ] Profit margin analysis
- [ ] GST summary report
- [ ] Prescription vs OTC sales ratio
- [ ] Sales by time of day
- [ ] Salesperson performance

### 20. Purchase Order Management
**Status:** ⚠️ Partial  
**Priority:** MEDIUM - Procurement workflow

**What's Needed:**
- [ ] PO generation from low stock alerts
- [ ] PO approval workflow
- [ ] PO to GRN (Goods Receipt Note) linking
- [ ] PO status tracking (draft, sent, confirmed, received)
- [ ] Automated PO based on reorder levels

---

## 🟢 LOW PRIORITY (Nice-to-Have Features)

### 21. PM-JAY / Ayushman Bharat Integration
**Status:** ❌ Not implemented  
**Priority:** LOW - Niche market

**What's Needed:**
- [ ] PM-JAY patient verification API
- [ ] PM-JAY billing format
- [ ] Claim submission to PM-JAY portal
- [ ] PM-JAY payment tracking

### 22. Aadhaar-Based Customer Verification
**Status:** ❌ Not implemented  
**Priority:** LOW - Optional but useful

**What's Needed:**
- [ ] Aadhaar number capture (masked display)
- [ ] Aadhaar verification API integration (UIDAI)
- [ ] Customer profile linking with Aadhaar
- [ ] Duplicate customer detection

### 23. Loyalty Program Enhancements
**Status:** ✅ Basic loyalty exists  
**Priority:** LOW - Enhancement

**What's Needed:**
- [ ] Tiered loyalty program (Bronze/Silver/Gold)
- [ ] Referral program
- [ ] Birthday bonuses
- [ ] Anniversary rewards
- [ ] Partner redemption (tie-ups with other businesses)

### 24. Barcode Printing for In-House Items
**Status:** ⚠️ Barcode reading exists, printing partial  
**Priority:** LOW - For generic medicines

**What's Needed:**
- [ ] Custom barcode generation (EAN-13, Code 128)
- [ ] Barcode label printing
- [ ] Print batch of barcodes
- [ ] Barcode template customization

### 25. Advanced Inventory Analytics
**Status:** ⚠️ Basic analytics exist  
**Priority:** LOW - Business intelligence

**What's Needed:**
- [ ] ABC/XYZ analysis
- [ ] Slow-moving item identification
- [ ] Dead stock analysis
- [ ] Inventory turnover ratio
- [ ] Demand forecasting (seasonal patterns)
- [ ] Supplier lead time analysis

---

## 🛠️ TECHNICAL ENHANCEMENTS

### 26. Complete Offline POS
**Status:** ⚠️ Infrastructure started, UI incomplete  
**Priority:** HIGH - Critical for power outages

**Remaining:**
- [ ] Complete offline sync UI
- [ ] Conflict resolution interface
- [ ] Offline banner/status indicator
- [ ] Sync queue management

### 27. Counter Copilot (AI Interaction Checking)
**Status:** ⚠️ Schema ready, implementation incomplete  
**Priority:** MEDIUM - Safety feature

**Remaining:**
- [ ] Drug interaction checking API
- [ ] Real-time interaction alerts at POS
- [ ] Counseling points display
- [ ] Pharmacist acknowledgement tracking

### 28. Rx OCR (Prescription Scanning)
**Status:** ⚠️ Schema ready, implementation incomplete  
**Priority:** MEDIUM - Time-saving feature

**Remaining:**
- [ ] OCR API integration (Tesseract/Google Vision/AWS Textract)
- [ ] Prescription image upload
- [ ] Text extraction and parsing
- [ ] Drug name matching to library
- [ ] Prescription validation UI

---

## 📊 SUMMARY BY PRIORITY

### Must-Have (Implement First):
1. ✅ E-Invoice NIC API Integration
2. ✅ E-Way Bill Generation
3. ✅ Credit Note with GST Reversal
4. ✅ Schedule H Drug Compliance Enforcement
5. ✅ WhatsApp Order Integration
6. ✅ Complete Offline POS
7. ✅ Daily Reports Dashboard

### Should-Have (Implement Next):
8. TCS (Tax Collected at Source)
9. Cash Memo for Small Sales
10. SMS/WhatsApp Notifications
11. Discount Coupons System
12. Stock Transfer Note (Multi-Branch)
13. Purchase Return Management
14. Rate Contract Management
15. Counter Copilot (AI Safety)
16. Rx OCR (Prescription Scanning)

### Nice-to-Have (Future):
17. Multi-Lingual Support
18. PM-JAY Integration
19. Aadhaar Verification
20. Advanced Inventory Analytics

---

## 🚀 RECOMMENDED IMPLEMENTATION ORDER

**Phase 1 (Months 1-2): GST & Compliance**
- E-Invoice integration
- E-Way Bill generation
- Credit Note with GST reversal
- TCS implementation

**Phase 2 (Months 3-4): Operations**
- Schedule H compliance enforcement
- Complete Offline POS
- WhatsApp order integration
- Daily reports dashboard

**Phase 3 (Months 5-6): Customer Engagement**
- SMS/WhatsApp notifications
- Discount coupons system
- Loyalty program enhancements

**Phase 4 (Months 7+): Advanced Features**
- Multi-lingual support
- Counter Copilot (AI)
- Rx OCR
- Advanced analytics

---

## 📝 NOTES

- **Market Research:** Talk to 5-10 pharmacy owners in different cities to prioritize
- **Regulatory Updates:** Monitor GST Council notifications and NPPD updates
- **Competitive Analysis:** Check what features competitors offer (1mg, Netmeds, PharmEasy)
- **User Feedback:** Implement features based on actual customer requests

---

**Last Updated:** January 2026  
**Next Review:** After Phase 1 completion