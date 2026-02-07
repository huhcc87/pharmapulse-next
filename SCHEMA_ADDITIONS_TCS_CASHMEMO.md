# Schema Additions for TCS and Cash Memo

**Date:** January 2026  
**Purpose:** Document schema changes needed for TCS and Cash Memo features

---

## **TCS (Tax Collected at Source) Fields**

### Invoice Model Additions:
```prisma
model Invoice {
  // ... existing fields ...
  
  // TCS (Tax Collected at Source) fields
  tcsAmountPaise    Int      @default(0) @map("tcs_amount_paise")
  tcsRate           Decimal? @db.Decimal(5, 2) @map("tcs_rate") // 0.1% or 1%
  tcsCertificateNumber String? @map("tcs_certificate_number") // Form 27D certificate number
  tcsCertificateIssuedAt DateTime? @map("tcs_certificate_issued_at")
}
```

### InvoiceLineItem Model Additions (Optional):
```prisma
model InvoiceLineItem {
  // ... existing fields ...
  
  // TCS per line item (if needed)
  tcsAmountPaise    Int      @default(0) @map("tcs_amount_paise")
  tcsRate           Decimal? @db.Decimal(5, 2) @map("tcs_rate")
}
```

### New Model: TCSCertificate
```prisma
model TCSCertificate {
  id                Int      @id @default(autoincrement())
  certificateNumber String  @unique @map("certificate_number") // TCS/FY/QX/0001
  tenantId          Int      @map("tenant_id")
  customerId        Int      @map("customer_id")
  
  financialYear     String   @map("financial_year") // "2024-25"
  quarter           String   // Q1, Q2, Q3, Q4
  issueDate         DateTime @default(now()) @map("issue_date")
  
  totalTCSCollectedPaise Int @map("total_tcs_collected_paise")
  invoiceCount      Int      @default(0) @map("invoice_count")
  
  customer          Customer @relation(fields: [customerId], references: [id])
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([tenantId])
  @@index([customerId])
  @@index([financialYear, quarter])
  @@map("tcs_certificates")
}
```

---

## **Cash Memo Fields**

### Invoice Model Additions:
```prisma
model Invoice {
  // ... existing fields ...
  
  // Cash Memo fields
  isCashMemo        Boolean  @default(false) @map("is_cash_memo")
  cashMemoNumber    String?  @unique @map("cash_memo_number") // CM/YYYY-MM/0001
}
```

**Note:** Cash memo uses same Invoice model, just with `invoiceType: "CASH_MEMO"` or `isCashMemo: true` flag.

---

## **Migration Steps**

1. Add TCS fields to `Invoice` model
2. Add `TCSCertificate` model
3. Add Cash Memo fields to `Invoice` model
4. Run `npm run db:sync` or create migration
5. Update Prisma client: `npx prisma generate`

---

**Status:** Schema changes documented, ready for migration
