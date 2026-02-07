# Schema Migration Required

**Date:** January 2026  
**Status:** ⚠️ **MIGRATION NEEDED**

This document lists all schema changes required for the newly implemented features.

---

## 🔴 **REQUIRED MIGRATIONS**

### 1. Health Reminder Model (NEW)
**Feature:** Health Reminders & Medication Adherence  
**Priority:** HIGH

```prisma
model HealthReminder {
  id              Int      @id @default(autoincrement())
  tenantId        Int      @default(1) @map("tenant_id")
  customerId      Int      @map("customer_id")
  
  reminderType    String   @map("reminder_type") // MEDICINE_INTAKE, PRESCRIPTION_REFILL, HEALTH_CHECKUP, VACCINATION, CUSTOM
  title           String
  description     String?
  scheduledDate   DateTime @map("scheduled_date")
  frequency       String   @default("ONE_TIME") // DAILY, WEEKLY, MONTHLY, YEARLY, ONE_TIME
  
  // Medicine-specific fields
  medicineName    String?  @map("medicine_name")
  prescriptionId  Int?     @map("prescription_id")
  dosage          String?  // e.g., "1-0-1" (morning, afternoon, evening)
  
  // Status
  isCompleted     Boolean  @default(false) @map("is_completed")
  completedAt     DateTime? @map("completed_at")
  snoozeUntil     DateTime? @map("snooze_until")
  
  // Relations
  customer        Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  prescription    Prescription? @relation(fields: [prescriptionId], references: [id])
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([tenantId])
  @@index([customerId])
  @@index([scheduledDate])
  @@index([reminderType])
  @@index([isCompleted])
  @@map("health_reminders")
}
```

**Add to Customer model:**
```prisma
model Customer {
  // ... existing fields
  healthReminders HealthReminder[]
}
```

**Add to Prescription model:**
```prisma
model Prescription {
  // ... existing fields
  healthReminders HealthReminder[]
}
```

---

### 2. TCS Fields (Invoice Model)
**Feature:** TCS (Tax Collected at Source)  
**Priority:** HIGH

```prisma
model Invoice {
  // ... existing fields
  
  // TCS fields
  tcsAmountPaise          Int      @default(0) @map("tcs_amount_paise")
  tcsRate                 Decimal? @db.Decimal(5, 2) @map("tcs_rate")
  tcsCertificateNumber    String?  @unique @map("tcs_certificate_number")
  tcsCertificateIssuedAt  DateTime? @map("tcs_certificate_issued_at")
}
```

**New Model: TCSCertificate**
```prisma
model TCSCertificate {
  id                    Int      @id @default(autoincrement())
  tenantId              Int      @default(1) @map("tenant_id")
  certificateNumber     String   @unique @map("certificate_number") // TCS/YYYY-MM/0001
  customerId            Int      @map("customer_id")
  
  financialYear         String   @map("financial_year") // 2024-25
  quarter               String   // Q1, Q2, Q3, Q4
  
  totalSalesPaise       Int      @map("total_sales_paise")
  tcsAmountPaise        Int      @map("tcs_amount_paise")
  tcsRate               Decimal  @db.Decimal(5, 2) @map("tcs_rate")
  
  issuedAt              DateTime @default(now()) @map("issued_at")
  
  customer              Customer @relation(fields: [customerId], references: [id])
  invoices              Invoice[]
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@index([tenantId])
  @@index([customerId])
  @@index([financialYear, quarter])
  @@map("tcs_certificates")
}
```

**Add to Customer model:**
```prisma
model Customer {
  // ... existing fields
  tcsCertificates TCSCertificate[]
}
```

**Add to Invoice model:**
```prisma
model Invoice {
  // ... existing fields
  tcsCertificateId      Int?     @map("tcs_certificate_id")
  tcsCertificate        TCSCertificate? @relation(fields: [tcsCertificateId], references: [id])
}
```

---

### 3. Cash Memo Fields (Invoice Model)
**Feature:** Cash Memo for Small Sales  
**Priority:** MEDIUM

```prisma
model Invoice {
  // ... existing fields
  
  // Cash Memo fields
  isCashMemo            Boolean  @default(false) @map("is_cash_memo")
  cashMemoNumber        String?  @unique @map("cash_memo_number") // CM/YYYY-MM/0001
}
```

---

## 📋 **MIGRATION STEPS**

### Step 1: Create Migration File
```bash
cd pharmapulse-next
npx prisma migrate dev --name add_health_reminders_tcs_cash_memo
```

### Step 2: Review Generated Migration
- Check `prisma/migrations/YYYYMMDDHHMMSS_add_health_reminders_tcs_cash_memo/migration.sql`
- Verify all fields are correct

### Step 3: Apply Migration
```bash
npx prisma migrate deploy
```

### Step 4: Generate Prisma Client
```bash
npx prisma generate
```

### Step 5: Update Application Code
- Update any code that references the old schema
- Test all affected APIs

---

## ✅ **VERIFICATION CHECKLIST**

After migration:

- [ ] HealthReminder model exists in schema
- [ ] TCS fields added to Invoice model
- [ ] TCSCertificate model created
- [ ] Cash Memo fields added to Invoice model
- [ ] Prisma client regenerated
- [ ] All APIs tested
- [ ] No TypeScript errors
- [ ] Database migration successful

---

## 🔍 **TESTING QUERIES**

### Test Health Reminder Creation
```typescript
const reminder = await prisma.healthReminder.create({
  data: {
    tenantId: 1,
    customerId: 1,
    reminderType: "MEDICINE_INTAKE",
    title: "Take Medicine",
    scheduledDate: new Date(),
    frequency: "DAILY",
  },
});
```

### Test TCS Certificate
```typescript
const certificate = await prisma.tcsCertificate.create({
  data: {
    tenantId: 1,
    customerId: 1,
    certificateNumber: "TCS/2024-25/0001",
    financialYear: "2024-25",
    quarter: "Q1",
    totalSalesPaise: 10000000,
    tcsAmountPaise: 100000,
    tcsRate: 1.0,
  },
});
```

### Test Cash Memo
```typescript
const invoice = await prisma.invoice.create({
  data: {
    // ... other fields
    isCashMemo: true,
    cashMemoNumber: "CM/2024-01/0001",
  },
});
```

---

## 📝 **NOTES**

1. **Backup Database** before running migration
2. **Test in Development** environment first
3. **Review Foreign Key Constraints** - ensure they're correct
4. **Index Performance** - verify indexes are created
5. **Data Migration** - if migrating existing data, create separate script

---

**Last Updated:** January 2026  
**Status:** ⚠️ **PENDING MIGRATION**
