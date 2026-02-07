# Security Scan Report - PharmaPulse

**Date:** 2024
**Scanner:** Security Engineering Review
**Status:** ⚠️ CRITICAL GAPS IDENTIFIED

---

## 1. TECH STACK DETECTED

### Client Stack
- **Framework:** Next.js 14 (React 18)
- **Type:** Web Application (PWA capable)
- **Mobile:** Referenced but no native code in repo (likely separate apps)
- **Auth Client:** NextAuth.js (minimal implementation)
- **State:** Zustand, React hooks

### Backend Stack
- **Runtime:** Node.js (Next.js API Routes)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** NextAuth.js (beta v5.0.0-beta.30) - **INCOMPLETE**
- **API Style:** REST (Next.js API Routes)

### Database
- **Type:** PostgreSQL
- **ORM:** Prisma
- **Schema:** Multi-tenant (tenantId on most models)
- **Existing Security Models:**
  - `License` (basic)
  - `DeviceRegistration` (basic)
  - `Role`, `Permission`, `UserRole` (RBAC exists)
  - `AuditLog` (basic)

---

## 2. AUTHENTICATION ANALYSIS

### Current Auth Flow
**Location:** `src/lib/auth.ts`

**Issues:**
1. ❌ **Cookie-based auth only** - No JWT tokens
2. ❌ **No refresh tokens** - Sessions never expire properly
3. ❌ **No token rotation** - Static cookies
4. ❌ **Weak session management** - Long-lived cookies (365 days)
5. ❌ **Development fallback** - Auto-creates tenants (security risk)
6. ❌ **No MFA support**
7. ❌ **No account lockout**
8. ❌ **No password policy enforcement**

**Current Implementation:**
```typescript
// Reads cookies: pp_tenant, pp_user, pp_email, pp_role
// No JWT, no refresh, no rotation
// Development mode auto-creates tenants (INSECURE)
```

### Where Auth Happens
- **Client:** `src/app/login/page.tsx` - Uses NextAuth `signIn()`
- **Server:** `src/lib/auth.ts` - Cookie-based session reading
- **API Routes:** Most routes call `getSessionUser()` then `requireAuth()`

**Gaps:**
- No JWT validation
- No refresh token mechanism
- No session revocation
- No rate limiting on auth endpoints
- No brute force protection

---

## 3. LICENSING ANALYSIS

### Current Licensing
**Location:** `prisma/schema.prisma` (License model exists)

**Issues:**
1. ❌ **No entitlement system** - No signed, short-lived entitlements
2. ❌ **No license refresh mechanism** - Static license status
3. ❌ **Device binding exists but weak** - No strict enforcement
4. ❌ **No license states** - Missing PAST_DUE, SUSPENDED, REVOKED
5. ❌ **No license types** - Missing TRIAL, MONTHLY, ANNUAL, LIFETIME
6. ❌ **No client entitlement validation** - Client can be modified
7. ❌ **No limited mode** - App doesn't degrade on license failure

**Existing Models:**
- `License` - Basic structure exists
- `DeviceRegistration` - Device tracking exists
- `LicenseAuditLog` - Audit exists

**Missing:**
- `Entitlement` - Signed, short-lived tokens
- `LicenseDevice` - Strict device binding
- `LicenseEvent` - License lifecycle events

---

## 4. RBAC ANALYSIS

### Current RBAC
**Location:** `src/lib/security/rbac.ts`

**Status:** ✅ Partially implemented

**Roles Found:**
- OWNER, ADMIN, PHARMACIST, CASHIER, INVENTORY, AUDITOR, SUPER_ADMIN

**Issues:**
1. ⚠️ **Role naming mismatch** - Uses OWNER_ADMIN vs OWNER
2. ⚠️ **Missing ORG_ADMIN** - Required role not present
3. ⚠️ **Permission checks inconsistent** - Some routes skip checks
4. ⚠️ **No permission caching** - DB query on every check

**What Works:**
- ✅ Role/permission tables exist
- ✅ `requirePermission()` function exists
- ✅ Server-side checks implemented

**What's Missing:**
- ❌ OWNER_ADMIN role (needs to be OWNER)
- ❌ ORG_ADMIN role
- ❌ Permission caching
- ❌ Permission inheritance

---

## 5. API SECURITY ANALYSIS

### Current State
**Issues:**
1. ❌ **No request validation** - Some routes skip Zod validation
2. ❌ **No rate limiting** - Unlimited API calls
3. ❌ **No CORS enforcement** - Permissive CORS
4. ❌ **No security headers** - Missing CSP, HSTS, etc.
5. ❌ **SQL injection risk** - Some raw queries (low, Prisma mostly)
6. ❌ **No correlation IDs** - Hard to trace requests
7. ❌ **Inconsistent error handling** - Leaks internal errors

**Existing:**
- ✅ Some routes use Zod validation
- ✅ Prisma ORM (parameterized queries)
- ✅ Basic audit logging

---

## 6. DEVICE BINDING ANALYSIS

### Current Implementation
**Location:** `src/lib/licensing/device-id.ts`, `src/lib/licensing/ip-extraction.ts`

**Status:** ⚠️ Partially implemented

**Issues:**
1. ❌ **Not strict** - Allows device changes too easily
2. ❌ **No device secret** - No per-device server-issued secret
3. ❌ **IP only soft signal** - Should be stricter
4. ❌ **No mobile device distinction** - Doesn't separate PC vs mobile
5. ❌ **No device reset cooldown** - Can reset too frequently

**What Exists:**
- ✅ Device ID generation
- ✅ IP extraction
- ✅ Device registration API

**What's Missing:**
- ❌ Strict 1 PC + 1 mobile enforcement
- ❌ Device secrets
- ❌ Reset cooldowns
- ❌ Device type validation

---

## 7. ADMIN CONSOLE ANALYSIS

### Current State
**Status:** ❌ NOT IMPLEMENTED

**Missing:**
- ❌ No admin console
- ❌ No user management UI
- ❌ No session revocation UI
- ❌ No license management UI
- ❌ No device reset UI
- ❌ No feature flag toggles
- ❌ No security dashboard

**Existing:**
- ✅ Settings page exists (`src/app/settings/page.tsx`)
- ✅ Some admin routes exist but no UI

---

## 8. ANTI-TAMPERING ANALYSIS

### Current State
**Status:** ❌ NOT IMPLEMENTED

**Missing:**
- ❌ No TLS certificate pinning
- ❌ No runtime integrity checks
- ❌ No obfuscation guidance
- ❌ No app version validation
- ❌ No platform validation
- ❌ No build signature validation
- ❌ No replay protection (nonce/timestamp)
- ❌ No per-device secrets

---

## 9. MONITORING & AUDIT ANALYSIS

### Current State
**Status:** ⚠️ Basic implementation exists

**Issues:**
1. ⚠️ **Audit logs not immutable** - Can be modified
2. ⚠️ **No security event tracking** - Missing failed logins, license collisions
3. ⚠️ **No kill switch** - Can't disable app remotely
4. ⚠️ **No security dashboard** - No admin visibility
5. ⚠️ **No correlation IDs** - Hard to trace events

**What Exists:**
- ✅ `AuditLog` model
- ✅ `LicenseAuditLog` model
- ✅ Some routes log actions

**What's Missing:**
- ❌ Immutable audit logs
- ❌ Security event tracking
- ❌ Global kill switch
- ❌ Security dashboard
- ❌ Event correlation

---

## 10. CRITICAL GAPS SUMMARY

### 🔴 CRITICAL (Must Fix)
1. **No JWT + Refresh Tokens** - Current cookie auth is insecure
2. **No License Entitlements** - License can be bypassed client-side
3. **No Device Binding Enforcement** - Devices not strictly bound
4. **No Admin Console** - Can't manage remotely
5. **No Kill Switch** - Can't disable app remotely
6. **No Rate Limiting** - Vulnerable to abuse
7. **No MFA** - Accounts vulnerable
8. **No Account Lockout** - Brute force vulnerable

### 🟡 HIGH PRIORITY
1. **Weak Session Management** - Long-lived cookies
2. **No Request Validation** - Some routes unvalidated
3. **No CORS Enforcement** - Permissive CORS
4. **No Security Headers** - Missing CSP, HSTS
5. **No Anti-Tampering** - Client can be modified
6. **No Replay Protection** - Requests can be replayed

### 🟢 MEDIUM PRIORITY
1. **RBAC Role Mismatch** - Need OWNER_ADMIN, ORG_ADMIN
2. **No Permission Caching** - Performance issue
3. **No Correlation IDs** - Hard to debug
4. **Audit Logs Not Immutable** - Can be tampered

---

## 11. FILES TO MODIFY/CREATE

### New Files (Security Infrastructure)
- `src/lib/auth/jwt.ts` - JWT generation/validation
- `src/lib/auth/refresh-tokens.ts` - Refresh token management
- `src/lib/auth/mfa.ts` - MFA implementation
- `src/lib/licensing/entitlements.ts` - Entitlement system
- `src/lib/licensing/device-binding.ts` - Strict device binding
- `src/lib/security/rate-limiting.ts` - Rate limiting
- `src/lib/security/request-validation.ts` - Request validation middleware
- `src/lib/security/anti-tampering.ts` - Client validation
- `src/lib/security/kill-switch.ts` - Global kill switch
- `src/lib/security/audit-immutable.ts` - Immutable audit logs
- `src/app/api/auth/refresh/route.ts` - Refresh token endpoint
- `src/app/api/license/activate/route.ts` - License activation
- `src/app/api/license/refresh/route.ts` - License refresh
- `src/app/api/admin/*` - Admin console APIs
- `src/app/admin/*` - Admin console UI
- `prisma/migrations/add_security_hardening.sql` - DB migrations

### Files to Modify
- `src/lib/auth.ts` - Replace with JWT-based auth
- `src/lib/security/rbac.ts` - Add OWNER_ADMIN, ORG_ADMIN
- `prisma/schema.prisma` - Add security models
- `src/app/api/**/*.ts` - Add auth/rate limiting to all routes
- `next.config.js` - Add security headers
- `.env.example` - Add security env vars

---

## 12. IMPLEMENTATION PHASES

### Phase 1: Auth + RBAC ✅ START HERE
- Implement JWT + refresh tokens
- Add MFA support
- Add account lockout
- Fix RBAC roles (OWNER_ADMIN, ORG_ADMIN, USER)
- Add permission caching

### Phase 2: Licensing + Device Binding
- Implement entitlement system
- Add license types/states
- Strict device binding (1 PC + 1 mobile)
- License refresh mechanism
- Limited mode on failure

### Phase 3: Admin Console + Audit
- Build admin console UI
- Remote session revocation
- License management UI
- Device reset UI
- Security dashboard
- Immutable audit logs

### Phase 4: Client Hardening
- TLS certificate pinning (if mobile)
- Runtime integrity checks
- App version validation
- Replay protection (nonce/timestamp)
- Per-device secrets

### Phase 5: API Security + Monitoring
- Request validation middleware
- Rate limiting
- CORS enforcement
- Security headers
- Correlation IDs
- Kill switch
- Security event tracking

---

## 13. RISK ASSESSMENT

### Current Risk Level: 🔴 **CRITICAL**

**Attack Vectors:**
1. **Cookie Theft** - Long-lived cookies can be stolen
2. **License Bypass** - Client can modify license checks
3. **Device Spoofing** - Device IDs can be faked
4. **Brute Force** - No rate limiting on login
5. **Session Hijacking** - No token rotation
6. **Replay Attacks** - No nonce/timestamp validation
7. **Client Tampering** - No integrity checks

**Impact:**
- Unauthorized access
- License theft
- Data breach
- Service abuse
- Financial loss

---

## 14. RECOMMENDATIONS

### Immediate Actions
1. ✅ Implement JWT + refresh tokens (Phase 1)
2. ✅ Add rate limiting to auth endpoints (Phase 1)
3. ✅ Implement entitlement system (Phase 2)
4. ✅ Add strict device binding (Phase 2)
5. ✅ Build admin console (Phase 3)

### Short-term (1-2 weeks)
1. Add MFA for admins
2. Implement kill switch
3. Add security headers
4. Enable CORS enforcement
5. Add request validation

### Long-term (1-2 months)
1. Client hardening (mobile apps)
2. Advanced monitoring
3. Security dashboard
4. Penetration testing
5. Compliance audit

---

**Next Step:** Begin Phase 1 implementation (Auth + RBAC)
