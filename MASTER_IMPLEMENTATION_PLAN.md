# Master Implementation Plan - PharmaPulse Security Hardening

**Status:** Phase 1 Started  
**Market:** India (UPC/EAN + GS1 DataMatrix + QR)  
**Goal:** Server-Authoritative System with Offline Grace, Metering, Feature Flags, Support Codes, Drug Scanning Pipeline

---

## ✅ COMPLETED

1. **Comprehensive Security Scan** - `COMPREHENSIVE_SECURITY_SCAN.md`
2. **Database Migration SQL** - `prisma/migrations/add_comprehensive_security_modules.sql`
3. **Threat Model** - Top 15 threats identified
4. **File Change Plan** - 50+ new files, 20+ modifications

---

## 📋 IMPLEMENTATION STATUS BY PHASE

### Phase 1: Auth/RBAC/Sessions ⏳ IN PROGRESS

**Status:** 40% Complete

**Completed:**
- ✅ JWT utilities (`src/lib/auth/jwt.ts`)
- ✅ Refresh token management (`src/lib/auth/refresh-tokens.ts`)
- ✅ Account lockout (`src/lib/auth/account-lockout.ts`)
- ✅ Database models (RefreshToken, ActiveSession, MfaSecret, AccountLockout)

**Remaining:**
- ⏳ Session management (`src/lib/auth/sessions.ts`)
- ⏳ MFA implementation (`src/lib/auth/mfa.ts`)
- ⏳ Auth API routes (login, refresh, logout)
- ⏳ Update main auth.ts to use JWT
- ⏳ Add SUPPORT_AGENT role
- ⏳ Session management UI

---

### Phase 2: Licensing/Entitlements/Offline Grace/Device Binding ⏳ PENDING

**Status:** 0% Complete (Schema Ready)

**To Implement:**
- ⏳ Entitlement system (`src/lib/licensing/entitlements.ts`)
- ⏳ Offline grace period (`src/lib/licensing/offline-grace.ts`)
- ⏳ Device binding enforcement (`src/lib/licensing/device-binding.ts`)
- ⏳ License activation/refresh APIs
- ⏳ Device reset cooldowns
- ⏳ Limited mode on failure

**Database:** ✅ Models ready (LicenseEntitlement, CachedEntitlement, LicenseDevice)

---

### Phase 3: Metering + Feature Flags ⏳ PENDING

**Status:** 0% Complete (Schema Ready)

**To Implement:**
- ⏳ Usage counters (`src/lib/metering/usage-counters.ts`)
- ⏳ Quota enforcement (`src/lib/metering/quota-enforcement.ts`)
- ⏳ Feature flags system (`src/lib/features/flags.ts`)
- ⏳ Entitlement-driven features
- ⏳ Billing hooks

**Database:** ✅ Models ready (UsageCounter, FeatureFlag, OrgFeatureOverride, LicenseFeatureOverride)

---

### Phase 4: Support Session Codes + Audit Logs + Admin Console ⏳ PENDING

**Status:** 0% Complete (Schema Ready)

**To Implement:**
- ⏳ Support code generation (`src/lib/support/session-codes.ts`)
- ⏳ Remote diagnostics (`src/lib/support/diagnostics.ts`)
- ⏳ View-as-user (read-only)
- ⏳ Immutable audit logs (`src/lib/audit/immutable-logs.ts`)
- ⏳ Admin dashboard UI

**Database:** ✅ Models ready (SupportSession, SupportAction, DiagnosticsBundle, AuditLogsImmutable)

---

### Phase 5: Drug Scanning Resolver + Library Sync ⏳ PENDING

**Status:** 0% Complete (Schema Ready)

**To Implement:**
- ⏳ GS1/DataMatrix parser (`src/lib/drug-scanning/gs1-parser.ts`)
- ⏳ Code resolver pipeline (`src/lib/drug-scanning/code-resolver.ts`)
- ⏳ Source integration (India) (`src/lib/drug-scanning/source-integration.ts`)
- ⏳ Delta sync (`src/lib/drug-scanning/delta-sync.ts`)
- ⏳ Conflict resolution (`src/lib/drug-scanning/conflict-resolution.ts`)
- ⏳ Admin review UI

**Database:** ✅ Models ready (ScanEvent, DrugProduct, DrugIdentifier, DrugPackage, DrugSource, DrugChangeLog, DrugReviewQueue)

---

### Phase 6: Client Hardening + Monitoring + Docs + Tests ⏳ PENDING

**Status:** 0% Complete

**To Implement:**
- ⏳ TLS certificate pinning
- ⏳ Replay protection (nonce/timestamp)
- ⏳ Integrity checks
- ⏳ Monitoring dashboard
- ⏳ Comprehensive documentation
- ⏳ Test suite

---

## 🚀 QUICK START IMPLEMENTATION

### Step 1: Run Database Migration

```bash
psql $DATABASE_URL -f prisma/migrations/add_comprehensive_security_modules.sql
npx prisma generate
```

### Step 2: Update Prisma Schema

Add all new models to `prisma/schema.prisma` (see migration SQL for structure)

### Step 3: Implement Core Modules (Priority Order)

1. **Offline Grace** - Critical for offline functionality
2. **Metering** - Required for billing/quota enforcement
3. **Feature Flags** - Needed for entitlement-driven features
4. **GS1 Parser** - Required for Indian market scanning
5. **Support Codes** - Needed for remote support
6. **Audit Logs** - Required for compliance

### Step 4: Create API Endpoints

- `/api/license/activate`
- `/api/license/refresh`
- `/api/usage/summary`
- `/api/usage/consume`
- `/api/features/flags`
- `/api/support/session/create`
- `/api/drug-scanning/scan`
- `/api/drug-library/updates`

### Step 5: Build Admin Console

- Users/devices/sessions management
- License management
- Feature flags UI
- Metering dashboard
- Support sessions
- Audit logs viewer
- Drug review queue

---

## 📁 FILE STRUCTURE

```
pharmapulse-next/
├── prisma/
│   ├── schema.prisma (update)
│   └── migrations/
│       └── add_comprehensive_security_modules.sql ✅
├── src/
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── jwt.ts ✅
│   │   │   ├── refresh-tokens.ts ✅
│   │   │   ├── account-lockout.ts ✅
│   │   │   ├── sessions.ts ⏳
│   │   │   └── mfa.ts ⏳
│   │   ├── licensing/
│   │   │   ├── entitlements.ts ⏳
│   │   │   ├── offline-grace.ts ⏳
│   │   │   └── device-binding.ts ⏳
│   │   ├── metering/
│   │   │   ├── usage-counters.ts ⏳
│   │   │   └── quota-enforcement.ts ⏳
│   │   ├── features/
│   │   │   └── flags.ts ⏳
│   │   ├── support/
│   │   │   ├── session-codes.ts ⏳
│   │   │   └── diagnostics.ts ⏳
│   │   ├── audit/
│   │   │   └── immutable-logs.ts ⏳
│   │   └── drug-scanning/
│   │       ├── gs1-parser.ts ⏳
│   │       ├── code-resolver.ts ⏳
│   │       ├── source-integration.ts ⏳
│   │       ├── delta-sync.ts ⏳
│   │       └── conflict-resolution.ts ⏳
│   └── app/
│       ├── api/
│       │   ├── license/ ⏳
│       │   ├── usage/ ⏳
│       │   ├── features/ ⏳
│       │   ├── support/ ⏳
│       │   └── drug-scanning/ ⏳
│       └── admin/ ⏳
└── docs/
    ├── COMPREHENSIVE_SECURITY_SCAN.md ✅
    ├── MASTER_IMPLEMENTATION_PLAN.md ✅
    ├── SECURITY.md ⏳
    └── README_SECURITY_SETUP.md ⏳
```

---

## ⚠️ CRITICAL NOTES

1. **Database Migration:** Must run before Prisma generate
2. **JWT_SECRET:** Must be set (32+ chars)
3. **Offline Grace:** 48-72h cache period
4. **Device Binding:** Strict 1 PC + 1 mobile
5. **GS1 Parser:** Must support Indian pharma standards
6. **Source Integration:** Only licensed APIs (no scraping)
7. **Audit Logs:** Append-only, hash-chained
8. **Support Codes:** 10-15 min expiry, read-only by default

---

## 📊 PROGRESS TRACKING

- **Phase 1:** 40% ✅
- **Phase 2:** 0% ⏳
- **Phase 3:** 0% ⏳
- **Phase 4:** 0% ⏳
- **Phase 5:** 0% ⏳
- **Phase 6:** 0% ⏳

**Overall:** 7% Complete

---

## 🎯 NEXT IMMEDIATE STEPS

1. ✅ Complete Phase 1 (Auth/RBAC/Sessions)
2. ⏳ Implement Offline Grace system
3. ⏳ Implement Metering system
4. ⏳ Implement Feature Flags
5. ⏳ Build GS1 Parser
6. ⏳ Create Drug Scanning Pipeline

**Estimated Time:** 2-3 weeks for full implementation

---

**Last Updated:** 2024  
**Status:** Foundation Complete, Core Modules Pending
