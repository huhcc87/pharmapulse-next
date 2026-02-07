# AI-Driven GST Invoice System - Implementation Roadmap

## ✅ COMPLETED FIXES

1. **Dropdown Transparency** - Fixed with `bg-white` styling
2. **Default State** - Set to Jammu & Kashmir (01)
3. **Auto HSN Codes** - Implemented HSN lookup from drug library
4. **Save/Issue Buttons** - Fixed validation and enabled properly
5. **B2C Empty Issue** - Fixed invoiceType auto-detection

## 📋 REMAINING IMPLEMENTATION TASKS

### Phase 1: Database Schema Extensions

#### 1.1 Add HSN and AI fields to DrugLibrary
```prisma
model DrugLibrary {
  // ... existing fields
  hsnCode          String?   @map("hsn_code")
  hsnSource        String?   @default("DEFAULT") @map("hsn_source") // MANUAL, AI_SUGGESTED, DEFAULT
  aiHsnConfidence  Float?    @map("ai_hsn_confidence")
  aiHsnRationale   String?   @map("ai_hsn_rationale")
  aiGstRationale   String?   @map("ai_gst_rationale")
}
```

#### 1.2 Add Organization Type and Customer Tables
```prisma
model Org {
  // ... existing fields
  orgType          String    @default("RETAILER") @map("org_type") // RETAILER, DISTRIBUTOR, WHOLESALER
  isGstRegistered  Boolean   @default(false) @map("is_gst_registered")
  pan              String?   @map("pan")
  address          String?   @map("address")
  city             String?   @map("city")
  stateCode        String?   @map("state_code")
  pincode          String?   @map("pincode")
}

model Customer {
  id          Int      @id @default(autoincrement())
  tenantId    Int      @map("tenant_id")
  name        String
  phone       String?
  email       String?
  gstin       String?  @map("gstin")
  address     String?
  stateCode   String?  @map("state_code")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  invoices    Invoice[]
  
  @@index([tenantId])
  @@map("customers")
}

model Invoice {
  // ... existing fields
  buyerOrgId       Int?      @map("buyer_org_id")
  buyerCustomerId  Int?      @map("buyer_customer_id")
  supplyType       String?   @map("supply_type") // INTRA, INTER
  metadata         Json?     @map("metadata")
  
  buyerOrg         Org?      @relation("BuyerOrg", fields: [buyerOrgId], references: [id])
  buyerCustomer    Customer? @relation(fields: [buyerCustomerId], references: [id])
  
  @@index([buyerOrgId])
  @@index([buyerCustomerId])
}
```

#### 1.3 Add AI and Source Tracking to InvoiceLineItem
```prisma
model InvoiceLineItem {
  // ... existing fields
  hsnSource        String?   @default("DEFAULT") @map("hsn_source")
  gstSource        String?   @default("DEFAULT") @map("gst_source")
  aiHsnConfidence  Float?    @map("ai_hsn_confidence")
  aiGstConfidence  Float?    @map("ai_gst_confidence")
  aiRationale      Json?     @map("ai_rationale")
}
```

#### 1.4 Create GSTReport Table
```prisma
model GSTReport {
  id            Int      @id @default(autoincrement())
  sellerOrgId   Int      @map("seller_org_id")
  periodStart   DateTime @map("period_start")
  periodEnd     DateTime @map("period_end")
  totals        Json     @map("totals")
  b2bTotals     Json     @map("b2b_totals")
  b2cTotals     Json     @map("b2c_totals")
  stateWise     Json     @map("state_wise")
  hsnWise       Json     @map("hsn_wise")
  generatedAt   DateTime @default(now()) @map("generated_at")
  generatedBy   String   @default("SYSTEM") @map("generated_by")
  exportPaths   Json?    @map("export_paths")
  
  sellerOrg     Org      @relation(fields: [sellerOrgId], references: [id])
  
  @@index([sellerOrgId, periodStart, periodEnd])
  @@map("gst_reports")
}
```

### Phase 2: Backend Classification & Validation

#### 2.1 Create Invoice Classification Service
**File**: `src/lib/gst/classifyInvoice.ts`

```typescript
export interface ClassificationResult {
  invoiceType: "B2B" | "B2C";
  supplyType: "INTRA" | "INTER";
  taxStrategy: "CGST_SGST" | "IGST";
}

export function classifyInvoice(params: {
  sellerOrg: { stateCode: string; orgType: string };
  buyerOrg?: { gstin?: string | null };
  buyerCustomer?: { gstin?: string | null };
  placeOfSupplyState: string;
}): ClassificationResult {
  // Implementation logic
}
```

#### 2.2 Enhanced GSTIN Validation
**File**: `src/lib/validateGst.ts` (extend existing)

```typescript
export function validateGSTINFormat(gstin: string): boolean {
  // Format validation + checksum
}

export function isGstRegistered(org: Org): boolean {
  return !!org.gstin && validateGSTINFormat(org.gstin);
}
```

### Phase 3: AI HSN/GST Suggestion System

#### 3.1 AI Suggestion API
**File**: `src/app/api/ai/gst-suggest/route.ts`

```typescript
export async function POST(req: Request) {
  const { brandName, genericName, composition, category, packSize, manufacturer } = await req.json();
  
  // 1. Check deterministic rules first
  // 2. If not found, call AI (OpenAI/Claude)
  // 3. Return with confidence score
  // 4. Store suggestion (don't auto-apply if confidence < 0.80)
}
```

#### 3.2 HSN Review Queue
**File**: `src/app/api/gst/review-queue/route.ts`

- List products/lines with low confidence or UNKNOWN
- Allow approval/rejection
- Track manual overrides

### Phase 4: Invoice Number Series (Role-based)

#### 4.1 Invoice Number Generator
**File**: `src/lib/gst/invoiceNumber.ts` (extend existing)

```typescript
export async function allocateInvoiceNumber(
  sellerGstinId: string,
  orgType: "RETAILER" | "DISTRIBUTOR" | "WHOLESALER"
): Promise<string> {
  const prefix = {
    RETAILER: "RET",
    DISTRIBUTOR: "DIS",
    WHOLESALER: "WHO"
  }[orgType];
  
  const year = new Date().getFullYear();
  // Atomic increment logic
  return `${prefix}-${year}-${paddedNumber}`;
}
```

### Phase 5: UI Enhancements

#### 5.1 Sale Type Selector
**File**: `src/app/dashboard/invoices/[id]/page.tsx`

- Add "Sale Type" radio: B2C (Patient) vs B2B (Business)
- Show buyer org search for B2B
- Show customer fields for B2C

#### 5.2 AI GST Assistant UI
**File**: `src/components/gst/AiGstAssistant.tsx`

- "Suggest HSN/GST" button
- Confidence indicators
- Review queue interface
- Manual override options

#### 5.3 Real-time Tax Summary
- Show CGST/SGST vs IGST breakdown
- Update on place of supply change
- Visual indicators for INTRA vs INTER

### Phase 6: GST Reporting

#### 6.1 Report Generator
**File**: `src/app/api/gst/reports/route.ts`

```typescript
export async function POST(req: Request) {
  const { sellerOrgId, periodStart, periodEnd } = await req.json();
  
  // Aggregate invoices
  // Calculate totals
  // Generate report JSON
  // Store in GSTReport table
}
```

#### 6.2 End-of-Year Summary
**File**: `src/app/api/gst/year-end-summary/route.ts`

- Annual totals
- Monthly breakdown
- B2B vs B2C split
- Top HSNs/products
- State-wise totals
- Export formats (CSV/JSON/PDF)

### Phase 7: PDF Enhancements

#### 7.1 Enhanced Invoice PDF
**File**: `src/app/api/invoices/[id]/pdf/route.ts`

- Show "TAX INVOICE (B2B)" or "RETAIL INVOICE (B2C)"
- Display HSN codes
- Show CGST/SGST vs IGST split clearly
- Include role-based invoice number series

### Phase 8: Role-Based Access Control

#### 8.1 RBAC Middleware
**File**: `src/lib/auth/rbac.ts`

- Check user role
- Enforce org type restrictions
- Restrict report generation to admins

## 🚀 QUICK START IMPLEMENTATION ORDER

1. **Database Migrations** (Phase 1) - Run Prisma migrations
2. **Classification Logic** (Phase 2) - Core B2B/B2C rules
3. **HSN Auto-population** (Phase 3.1) - Already started
4. **Invoice Number Series** (Phase 4) - Role-based prefixes
5. **UI Sale Type Selector** (Phase 5.1) - User-facing changes
6. **AI Suggestions** (Phase 3) - Enhanced intelligence
7. **Reporting** (Phase 6) - GST reports and summaries

## 📝 NOTES

- All changes maintain backward compatibility
- Existing invoices continue to work
- New features are additive, not breaking
- AI suggestions are opt-in (confidence gating)
- Manual overrides always available

## ✅ VERIFICATION CHECKLIST

- [ ] Create B2C invoice → shows B2C, defaults to seller state
- [ ] Create B2B invoice with GSTIN → shows B2B, validates GSTIN
- [ ] Change place of supply → tax switches INTRA/INTER correctly
- [ ] Add drug → HSN auto-populates
- [ ] AI suggestion → shows confidence, requires approval if low
- [ ] Generate monthly report → CSV/JSON export works
- [ ] Year-end summary → all totals correct
- [ ] PDF shows correct invoice type and tax breakdown










