# PharmaPulse One Billing System - Implementation Summary

**Date:** 2024  
**Status:** ✅ Backend Complete, Frontend Pending  
**Plan:** Single "PharmaPulse One" plan with one-time purchase + annual renewal

---

## ✅ COMPLETED

### 1. Database Schema ✅
- **Migration:** `prisma/migrations/add_pharmapulse_one_billing.sql`
- **Models Added:**
  - `CreditsLedger` - AI credits transaction ledger
  - `CreditBalanceCache` - Cached balance for performance
  - `BillingPayment` - Payment records
  - `BillingInvoice` - GST-ready invoices
  - `BillingAuditLog` - Audit trail
- **Subscription Updates:**
  - `planType` - 'one_time' or 'subscription'
  - `oneTimePurchasedAt`, `oneTimeAmountPaise`
  - `serviceRenewalStatus`, `serviceRenewalNextDue`
  - `branchesIncluded`, `prioritySupport`, `monthlyCreditGrant`

### 2. Backend Modules ✅

**Credits System:**
- `src/lib/billing/credits.ts` - Credits ledger, balance, monthly grants
- Functions: `getCreditBalance`, `addCredits`, `spendCredits`, `grantMonthlyCredits`

**Payment Provider:**
- `src/lib/billing/payment-provider.ts` - Stripe/Razorpay abstraction
- Functions: `createOrder`, `verifyWebhookSignature`, `handlePaymentSuccess`

### 3. API Endpoints ✅

- `POST /api/billing/plan/purchase` - Purchase PharmaPulse One (₹15,000 one-time)
- `POST /api/billing/renewal/subscribe` - Subscribe to annual renewal (₹1,000/year)
- `POST /api/billing/credits/topup` - Top-up AI credits (50,000 credits for ₹2,500)
- `GET /api/billing/status` - Get billing status
- `POST /api/billing/webhook` - Stripe webhook handler

**Features:**
- ✅ Idempotency key support
- ✅ Payment provider abstraction
- ✅ Webhook confirmation (server-side)
- ✅ Audit logging
- ✅ Credit ledger updates

---

## 📋 PENDING

### 4. Frontend UI ⏳

**Components to Create:**
- Single plan card component (replaces 3-plan selector)
- Credits top-up drawer/modal
- Billing status display
- Renewal banner (if past due)

**Files to Modify:**
- `src/app/settings/page.tsx` - Replace billing section
- Remove old plan selector modal

### 5. Monthly Grant Cron Job ⏳

**To Implement:**
- Scheduled job to grant monthly credits
- Run at start of each month (Asia/Kolkata timezone)
- Grant 50,000 credits to eligible orgs

### 6. Renewal Enforcement ⏳

**To Implement:**
- Feature flag checks based on renewal status
- Smart degrade (no hard lock)
- UI messaging for past due

### 7. Credits Middleware ⏳

**To Implement:**
- `requireCredits(amount)` middleware
- Atomic credit deduction on AI endpoints
- Prevent race conditions

---

## 📊 PLAN DETAILS

**PharmaPulse One:**
- Price: ₹15,000 (one-time)
- Renewal: ₹1,000/year for updates + service
- Includes:
  - 1 Branch
  - All Features
  - 50,000 AI Credits/month
  - Priority Support

**AI Credits Top-up:**
- Pack: 50,000 credits for ₹2,500 (one-time)
- Multiple purchases allowed
- Credits don't expire

---

## 🔒 SECURITY FEATURES

1. **Idempotency:** All purchases use idempotency keys
2. **Webhook Verification:** Server-side payment confirmation
3. **Audit Logging:** All billing actions logged
4. **Atomic Operations:** Credit deductions are atomic
5. **Multi-tenant Scoping:** All queries scoped to orgId

---

## 📁 FILES CREATED

### Database:
- `prisma/migrations/add_pharmapulse_one_billing.sql`

### Backend:
- `src/lib/billing/credits.ts`
- `src/lib/billing/payment-provider.ts`
- `src/app/api/billing/plan/purchase/route.ts`
- `src/app/api/billing/renewal/subscribe/route.ts`
- `src/app/api/billing/credits/topup/route.ts`
- `src/app/api/billing/status/route.ts`
- `src/app/api/billing/webhook/route.ts`

### Schema:
- Updated `prisma/schema.prisma` with new models

---

## 🚀 NEXT STEPS

1. **Run Migration:**
   ```bash
   psql $DATABASE_URL -f prisma/migrations/add_pharmapulse_one_billing.sql
   npx prisma generate
   ```

2. **Create Frontend UI:**
   - Single plan card
   - Credits top-up drawer
   - Billing status display

3. **Implement Monthly Grant Cron:**
   - Scheduled job
   - Grant credits at start of month

4. **Add Renewal Enforcement:**
   - Feature flag checks
   - Smart degrade logic

5. **Add Credits Middleware:**
   - Protect AI endpoints
   - Atomic deduction

---

**Status:** Backend 90% complete, Frontend 0% complete
