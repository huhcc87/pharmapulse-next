# Repo Scan Report - Yearly Subscription + Credits Refactor

**Date:** 2024  
**Status:** ✅ Scan Complete

---

## 📋 TECH STACK DETECTED

### Frontend
- **Framework:** Next.js 14.2.35
- **UI:** React 18, TypeScript, Tailwind CSS, shadcn/ui
- **State:** Zustand (optional)

### Backend
- **API:** Next.js API Routes
- **ORM:** Prisma 5.10.2
- **Database:** PostgreSQL

### Authentication
- **Method:** NextAuth.js v5 (beta)
- **Session:** Server-side sessions with JWT
- **Provider:** Credentials (email/password)
- **Location:** `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`

### Payment Provider
- **Provider:** Stripe (v20.1.2) ✅
- **Integration:** Already exists
- **Endpoints:** 
  - `/api/billing/create-checkout-session`
  - `/api/billing/webhook`
  - `/api/billing/create-portal-session`

### AI Integration
- **Provider:** OpenAI API
- **Endpoint:** `/api/ai/route.ts`
- **Features:** PARSE_PRODUCT_TEXT, COMPOSITION_LOOKUP, ALTERNATIVE_SUGGEST
- **Status:** No credits enforcement currently

---

## 🗄️ DATABASE SCHEMA (Current)

### Existing Billing Models ✅
- `Subscription` - Has status, planType, monthlyCreditGrant, aiCredits fields
- `CreditsLedger` - Append-only ledger (GRANT_MONTHLY, SPEND, ADJUST, REFUND)
- `BillingPayment` - Payment records
- `BillingInvoice` - Invoice records
- `BillingAuditLog` - Audit trail

### Missing Models ❌
- `CreditsMonthlyBucket` - Monthly credit buckets (org_id, month_yyyy_mm, granted, used, remaining)
- `CreditCostConfig` - Feature cost definitions (optional, can use constants)

### Org/Tenant Model
- `Org` - Has tenantId (unique)
- `User` - Has role, email, passwordHash

---

## 🔍 EXISTING AI ENDPOINTS

### Found:
- `/api/ai/route.ts` - Generic AI endpoint (no credits enforcement)

### Not Found (Need to Create):
- ❌ Rx OCR endpoint
- ❌ Reorder suggestion endpoint  
- ❌ Drug scan enrichment endpoint

**Note:** These may be integrated into existing endpoints or need to be created.

---

## 📁 FILES TO MODIFY/CREATE

### Phase 1: Plan UI Cleanup
- ✅ `src/app/settings/page.tsx` - Already refactored to single plan
- ⚠️ Need to verify/update to YEARLY-only

### Phase 2: Billing Backend
- ✅ `src/app/api/billing/plan/purchase/route.ts` - Exists, needs update
- ✅ `src/app/api/billing/status/route.ts` - Exists, needs update
- ✅ `src/app/api/billing/webhook/route.ts` - Exists, needs update
- ➕ `src/app/api/billing/subscribe/yearly/route.ts` - NEW
- ➕ `src/lib/billing/subscription.ts` - NEW (subscription utilities)

### Phase 3: Credits System
- ✅ `src/lib/billing/credits.ts` - Exists, needs refactor
- ➕ `src/lib/billing/credits-bucket.ts` - NEW (monthly bucket logic)
- ➕ `src/lib/billing/credits-enforcement.ts` - NEW (atomic spend)
- ➕ `src/app/api/cron/monthly-credits/route.ts` - Exists, needs update
- ➕ `src/app/api/credits/summary/route.ts` - NEW
- ➕ `src/app/api/credits/history/route.ts` - NEW
- ➕ `src/app/api/credits/ledger/route.ts` - NEW

### Phase 4: Credits Enforcement
- ⚠️ `src/app/api/ai/route.ts` - Add credits enforcement
- ➕ `src/app/api/ai/ocr/route.ts` - NEW (Rx OCR)
- ➕ `src/app/api/ai/reorder/route.ts` - NEW (Reorder suggestion)
- ➕ `src/app/api/drug-library/enrich/route.ts` - NEW (Drug scan enrichment)
- ➕ `src/lib/middleware/credits-guard.ts` - NEW (middleware)

### Phase 5: UI
- ➕ `src/app/credits/page.tsx` - NEW (Credits dashboard)
- ➕ `src/components/credits/CreditsWidget.tsx` - NEW (Top-bar widget)
- ⚠️ `src/app/settings/page.tsx` - Update billing section

### Migrations
- ➕ `prisma/migrations/add_yearly_subscription_credits.sql` - NEW

---

## 🚨 GAPS & RISKS

### Critical Gaps
1. ❌ **No monthly bucket system** - Credits are tracked in ledger but no monthly buckets
2. ❌ **No credits enforcement** - AI endpoints don't check credits
3. ❌ **No atomic spend** - Race conditions possible
4. ❌ **No subscription enforcement** - AI endpoints don't check subscription status
5. ❌ **Missing AI endpoints** - OCR, reorder, enrichment not found

### Risks
1. ⚠️ **Timezone handling** - Need Asia/Kolkata for monthly reset
2. ⚠️ **Concurrency** - Need row-level locking for atomic spend
3. ⚠️ **Idempotency** - Monthly grants must be idempotent
4. ⚠️ **Client trust** - All enforcement must be server-side

---

## 📝 IMPLEMENTATION PLAN

### Phase 1: Repo Scan + Plan UI Cleanup ✅
- [x] Scan repo
- [ ] Verify/update settings page to YEARLY-only
- [ ] Remove any other plan references

### Phase 2: Billing Yearly Subscription
- [ ] Update Subscription model (plan_code='YEARLY', subscription_status)
- [ ] Create `/api/billing/subscribe/yearly` endpoint
- [ ] Update webhook handler for subscription events
- [ ] Update `/api/billing/status` endpoint
- [ ] Add idempotency-key handling

### Phase 3: Credits Tables + Monthly Job
- [ ] Create CreditsMonthlyBucket model
- [ ] Create migration
- [ ] Implement monthly grant cron job
- [ ] Implement lazy grant fallback
- [ ] Create credits APIs (summary, history, ledger)

### Phase 4: Credits Enforcement
- [ ] Create credits enforcement utilities
- [ ] Add middleware for AI endpoints
- [ ] Update existing AI endpoint
- [ ] Create OCR endpoint (100 credits/page)
- [ ] Create reorder endpoint (50 credits/run)
- [ ] Create enrichment endpoint (5 credits/lookup)

### Phase 5: Credits UI + Widget
- [ ] Create credits dashboard page
- [ ] Create top-bar credits widget
- [ ] Update settings billing section
- [ ] Add audit logs
- [ ] Write tests

---

## 🔧 ENVIRONMENT VARIABLES NEEDED

```env
# Existing
DATABASE_URL=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
OPENAI_API_KEY=...

# New
CRON_SECRET=... # For monthly credits cron
YEARLY_PLAN_PRICE=15000 # Default ₹15,000
MONTHLY_CREDIT_GRANT=5000 # Default 5,000 credits/month
```

---

## ✅ NEXT STEPS

1. **Start Phase 1:** Clean up plan UI to YEARLY-only
2. **Phase 2:** Implement yearly subscription backend
3. **Phase 3:** Build credits bucket system
4. **Phase 4:** Add enforcement to AI endpoints
5. **Phase 5:** Build UI and tests

---

**Status:** Ready to begin Phase 1 implementation
