# Comprehensive Security & Architecture Scan - PharmaPulse

**Date:** 2024  
**Scope:** Server-Authoritative System with Offline Grace, Metering, Feature Flags, Support Codes, Drug Scanning Pipeline  
**Market:** India (UPC/EAN + GS1 DataMatrix + QR)

---

## 0. REPO SCAN RESULTS

### Tech Stack Detected

**Client:**
- Next.js 14 (React 18)
- TypeScript
- PWA with Service Worker (`public/sw.js`)
- Offline support (IndexedDB mentioned)
- Tailwind CSS + shadcn/ui

**Backend:**
- Next.js API Routes
- Prisma ORM
- PostgreSQL database
- Stripe integration (billing)

**Database:**
- PostgreSQL
- Multi-tenant architecture (tenantId on most models)
- Existing models: Product, DrugLibrary, DrugScanEvent, License, DeviceRegistration, etc.

**Auth:**
- NextAuth.js (beta v5.0.0-beta.30) - **INCOMPLETE**
- Cookie-based session (weak)
- JWT utilities created but not integrated
- RBAC partially implemented

**Payment:**
- Stripe integration exists
- Billing/subscription endpoints present
- Checkout flow implemented

### Current Endpoints

**Drug Library:**
- `GET /api/drug-library/by-qr` - QR code lookup
- `GET /api/drug-library/search` - Search drugs
- `GET /api/drug-library/health` - Health check

**Scanning:**
- `POST /api/inventory/add-from-qr` - Add from QR scan
- `POST /api/inventory/add-from-library` - Add from library
- Barcode resolver exists (`src/lib/barcode/resolver.ts`)

**Billing:**
- `POST /api/billing/create-checkout-session`
- `POST /api/billing/webhook`
- `GET /api/billing/status`

**Offline:**
- `POST /api/offline/sync`
- `POST /api/offline/issue-token`
- Service worker exists

### Existing Drug Library Structure

**Models Found:**
- `DrugLibrary` - Main drug table (brandName, manufacturer, qrCode, qrPayload, etc.)
- `DrugScanEvent` - Scan event tracking
- `DrugScanMemory` - Scan memory/cache
- `Product` - Inventory products (linked to DrugLibrary)
- `DrugPack`, `DrugBrand`, `DrugFormulation` - Drug hierarchy

**Current Scanning:**
- Supports QR codes (INMED-XXXXXX format)
- Basic barcode resolution
- No GS1 DataMatrix support
- No UPC/EAN parsing
- No GS1 Application Identifier parsing

### Gaps Identified

#### 🔴 CRITICAL GAPS

1. **No GS1/DataMatrix Support**
   - No GS1 Application Identifier parser
   - No DataMatrix format support
   - No GTIN-14 normalization
   - No EXP (expiry), BATCH, SERIAL parsing

2. **No Offline Grace Period**
   - No cached entitlement system
   - No 48-72h grace period
   - No limited mode on expiry

3. **No Metering System**
   - No usage counters
   - No quota enforcement
   - No billing hooks

4. **No Feature Flags**
   - No server-side feature flags
   - No entitlement-driven features
   - No org/license overrides

5. **No Support Session Codes**
   - No secure support codes
   - No remote diagnostics
   - No view-as-user capability

6. **Weak Audit Logging**
   - Basic audit logs exist
   - No tamper-evident hash chaining
   - No comprehensive event tracking

7. **No Drug Library Auto-Update**
   - No background sync jobs
   - No delta sync mechanism
   - No source integration layer
   - No conflict resolution

8. **No Indian Market Integration**
   - No CDSCO data integration
   - No licensed dataset integration
   - No government data sources

#### 🟡 HIGH PRIORITY GAPS

9. **Incomplete Auth System**
   - JWT utilities exist but not integrated
   - No refresh token rotation
   - No session management UI

10. **No Device Binding Enforcement**
    - Device registration exists but not enforced
    - No 1 PC + 1 mobile strict binding
    - No device reset cooldowns

11. **No Request Validation Middleware**
    - Some endpoints validate, others don't
    - No correlation IDs
    - No structured logging

12. **No Rate Limiting**
    - No rate limits on endpoints
    - No per-user/IP tracking

### Threat Model (Top 15 Threats)

1. **License Bypass** - Client can modify license checks
2. **Device Spoofing** - Fake device IDs
3. **Token Theft** - Long-lived cookies/tokens
4. **Brute Force** - No rate limiting on auth
5. **Replay Attacks** - No nonce/timestamp validation
6. **Client Tampering** - No integrity checks
7. **Data Exfiltration** - No export controls
8. **Unauthorized Support Access** - No secure support codes
9. **Metering Bypass** - No server-side metering
10. **Feature Flag Bypass** - Client can enable features
11. **Drug Library Poisoning** - No validation on updates
12. **GS1 Code Injection** - No parser validation
13. **Offline Abuse** - Unlimited offline usage
14. **Session Hijacking** - No token rotation
15. **Audit Log Tampering** - No hash chaining

### File Change Plan

#### New Files to Create (50+ files)

**Core Security:**
- `src/lib/auth/sessions.ts` - Session management
- `src/lib/auth/mfa.ts` - MFA implementation
- `src/lib/licensing/entitlements.ts` - Entitlement system
- `src/lib/licensing/offline-grace.ts` - Offline grace period
- `src/lib/licensing/device-binding.ts` - Strict device binding
- `src/lib/metering/usage-counters.ts` - Usage tracking
- `src/lib/metering/quota-enforcement.ts` - Quota checks
- `src/lib/features/flags.ts` - Feature flag system
- `src/lib/support/session-codes.ts` - Support codes
- `src/lib/support/diagnostics.ts` - Remote diagnostics
- `src/lib/audit/immutable-logs.ts` - Tamper-evident logs
- `src/lib/security/rate-limiting.ts` - Rate limiting
- `src/lib/security/request-validation.ts` - Request validation
- `src/lib/security/correlation-ids.ts` - Correlation tracking

**Drug Scanning Pipeline:**
- `src/lib/drug-scanning/gs1-parser.ts` - GS1 parser
- `src/lib/drug-scanning/code-resolver.ts` - Code resolver
- `src/lib/drug-scanning/source-integration.ts` - Source integration
- `src/lib/drug-scanning/conflict-resolution.ts` - Conflict handling
- `src/lib/drug-scanning/delta-sync.ts` - Delta sync
- `src/lib/drug-scanning/confidence-scoring.ts` - Confidence scoring

**API Endpoints:**
- `src/app/api/license/activate/route.ts`
- `src/app/api/license/refresh/route.ts`
- `src/app/api/license/rebind-request/route.ts`
- `src/app/api/usage/summary/route.ts`
- `src/app/api/usage/consume/route.ts`
- `src/app/api/features/flags/route.ts`
- `src/app/api/support/session/create/route.ts`
- `src/app/api/support/session/join/route.ts`
- `src/app/api/drug-scanning/scan/route.ts`
- `src/app/api/drug-library/updates/route.ts`
- `src/app/api/drug-library/version/route.ts`
- `src/app/api/admin/*` - Admin endpoints

**Admin Console:**
- `src/app/admin/*` - Admin pages

#### Files to Modify (20+ files)

- `src/lib/auth.ts` - Integrate JWT
- `src/lib/security/rbac.ts` - Add SUPPORT_AGENT role
- `prisma/schema.prisma` - Add all new models
- `src/middleware.ts` - Add auth/rate limiting
- All API routes - Add validation/rate limiting

#### Database Migrations

- `prisma/migrations/add_comprehensive_security.sql` - All security models
- `prisma/migrations/add_metering.sql` - Metering tables
- `prisma/migrations/add_drug_scanning.sql` - Drug scanning tables
- `prisma/migrations/add_feature_flags.sql` - Feature flags
- `prisma/migrations/add_support_sessions.sql` - Support sessions

---

## IMPLEMENTATION PLAN

### Phase 1: Auth/RBAC/Sessions (Foundation)
- Complete JWT integration
- Refresh token rotation
- Session management
- Account lockout
- MFA support
- SUPPORT_AGENT role

### Phase 2: Licensing/Entitlements/Offline Grace/Device Binding
- Entitlement system
- Offline grace period (48-72h)
- Strict device binding (1 PC + 1 mobile)
- Device reset cooldowns
- License activation/refresh

### Phase 3: Metering + Feature Flags
- Usage counters
- Quota enforcement
- Feature flags system
- Entitlement-driven features

### Phase 4: Support Session Codes + Audit Logs + Admin Console
- Support code generation
- Remote diagnostics
- View-as-user (read-only)
- Immutable audit logs
- Admin dashboard

### Phase 5: Drug Scanning Resolver + Library Sync + Review Workflow
- GS1/DataMatrix parser
- Code resolver pipeline
- Source integration (India)
- Delta sync
- Conflict resolution
- Admin review UI

### Phase 6: Client Hardening + Monitoring + Docs + Tests
- TLS pinning
- Replay protection
- Integrity checks
- Monitoring dashboard
- Documentation
- Test suite

---

## NEXT STEPS

1. ✅ Scan complete - Report generated
2. ⏳ Begin Phase 1 implementation
3. ⏳ Create database migrations
4. ⏳ Implement core modules
5. ⏳ Build admin console
6. ⏳ Add drug scanning pipeline
7. ⏳ Client hardening
8. ⏳ Documentation & tests

**Status:** Ready to begin Phase 1 implementation
