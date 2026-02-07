# Security Hardening Implementation Guide

## 📊 Executive Summary

This document outlines the comprehensive security hardening implementation for PharmaPulse. The system is being transformed from a basic cookie-based auth to an enterprise-grade, license-controlled, server-authoritative system.

**Status:** Phase 1 (Auth + RBAC) - 40% Complete

---

## 🔍 Initial Security Scan Results

See `SECURITY_SCAN_REPORT.md` for full details.

### Critical Findings:
- ❌ No JWT + Refresh Tokens (cookie-based only)
- ❌ No License Entitlements (client can bypass)
- ❌ No Device Binding Enforcement
- ❌ No Admin Console
- ❌ No Rate Limiting
- ❌ No MFA
- ❌ No Account Lockout

### Tech Stack Detected:
- **Client:** Next.js 14, React 18 (Web app)
- **Backend:** Next.js API Routes, PostgreSQL, Prisma
- **Auth:** NextAuth.js (minimal, needs replacement)
- **Database:** PostgreSQL with multi-tenant architecture

---

## 📋 Implementation Phases

### Phase 1: Auth + RBAC ✅ IN PROGRESS (40%)

**Status:** Database schema created, core utilities implemented

**Completed:**
- ✅ Database migration SQL
- ✅ Prisma schema updates
- ✅ JWT token utilities
- ✅ Refresh token management
- ✅ Account lockout system

**Remaining:**
- ⏳ MFA/TOTP implementation
- ⏳ Password reset flow
- ⏳ Session management
- ⏳ Auth API routes
- ⏳ RBAC role updates (OWNER_ADMIN, ORG_ADMIN)
- ⏳ Permission caching

**Files Created:**
- `prisma/migrations/add_security_hardening.sql`
- `src/lib/auth/jwt.ts`
- `src/lib/auth/refresh-tokens.ts`
- `src/lib/auth/account-lockout.ts`

**Next Steps:**
1. Install dependencies: `npm install jsonwebtoken @types/jsonwebtoken speakeasy qrcode`
2. Run migration: `psql $DATABASE_URL -f prisma/migrations/add_security_hardening.sql`
3. Generate Prisma client: `npx prisma generate`
4. Complete auth implementation (see TODO list)

---

### Phase 2: Licensing + Device Binding (0%)

**Planned:**
- License entitlement system
- License types (TRIAL, MONTHLY, ANNUAL, LIFETIME)
- License states (ACTIVE, PAST_DUE, SUSPENDED, REVOKED)
- Strict device binding (1 PC + 1 mobile)
- Device reset cooldowns
- Limited mode on license failure

**Files to Create:**
- `src/lib/licensing/entitlements.ts`
- `src/lib/licensing/device-binding.ts`
- `src/lib/licensing/license-validation.ts`
- `src/app/api/license/activate/route.ts`
- `src/app/api/license/refresh/route.ts`

---

### Phase 3: Admin Console + Audit (0%)

**Planned:**
- Admin console UI
- Remote session revocation
- License management
- Device reset UI
- Security dashboard
- Immutable audit logs

**Files to Create:**
- `src/app/admin/*` (admin console pages)
- `src/app/api/admin/*` (admin APIs)
- `src/lib/security/audit-immutable.ts`

---

### Phase 4: Client Hardening (0%)

**Planned:**
- TLS certificate pinning (mobile)
- Runtime integrity checks
- App version validation
- Replay protection (nonce/timestamp)
- Per-device secrets

**Files to Create:**
- `src/lib/security/anti-tampering.ts`
- `src/lib/security/client-validation.ts`

---

### Phase 5: API Security + Monitoring (0%)

**Planned:**
- Request validation middleware
- Rate limiting
- CORS enforcement
- Security headers
- Correlation IDs
- Kill switch
- Security event tracking

**Files to Create:**
- `src/lib/security/rate-limiting.ts`
- `src/lib/security/request-validation.ts`
- `src/lib/security/kill-switch.ts`
- `src/middleware.ts` (Next.js middleware)

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd pharmapulse-next
npm install jsonwebtoken @types/jsonwebtoken
npm install speakeasy qrcode @types/speakeasy @types/qrcode
npm install bcrypt @types/bcrypt  # If not already installed
```

### 2. Set Environment Variables

Add to `.env`:

```env
# JWT Configuration
JWT_SECRET=your-very-strong-secret-key-min-32-chars
JWT_ISSUER=pharmapulse
JWT_AUDIENCE=pharmapulse-client

# Existing
NEXTAUTH_SECRET=your-nextauth-secret
DATABASE_URL=postgresql://...
```

### 3. Run Database Migration

```bash
# Run SQL migration
psql $DATABASE_URL -f prisma/migrations/add_security_hardening.sql

# Generate Prisma client
npx prisma generate
```

### 4. Test Installation

```bash
npm run dev
```

---

## 📁 File Structure

```
pharmapulse-next/
├── prisma/
│   ├── schema.prisma (updated)
│   └── migrations/
│       └── add_security_hardening.sql (new)
├── src/
│   ├── lib/
│   │   └── auth/
│   │       ├── jwt.ts (new)
│   │       ├── refresh-tokens.ts (new)
│   │       ├── account-lockout.ts (new)
│   │       ├── mfa.ts (TODO)
│   │       ├── password-reset.ts (TODO)
│   │       └── sessions.ts (TODO)
│   ├── app/
│   │   └── api/
│   │       └── auth/
│   │           ├── login/route.ts (TODO)
│   │           ├── refresh/route.ts (TODO)
│   │           └── logout/route.ts (TODO)
│   └── middleware.ts (TODO)
└── SECURITY_*.md (documentation)
```

---

## 🔐 Security Features Implemented

### ✅ JWT Authentication
- Short-lived access tokens (15 min)
- Long-lived refresh tokens (7 days)
- Token rotation on refresh
- Server-side validation

### ✅ Account Security
- Account lockout after 5 failed attempts
- 30-minute lockout duration
- Failed attempt tracking
- Manual lock/unlock (admin)

### ✅ Token Management
- Refresh token hashing (SHA-256)
- Token revocation
- Bulk token revocation
- Expired token cleanup

---

## 📝 TODO: Complete Phase 1

### High Priority
1. **MFA Implementation**
   - Create `src/lib/auth/mfa.ts`
   - TOTP secret generation
   - QR code generation
   - TOTP verification

2. **Password Reset**
   - Create `src/lib/auth/password-reset.ts`
   - Token generation
   - Email sending (integrate with email service)
   - Password update flow

3. **Session Management**
   - Create `src/lib/auth/sessions.ts`
   - Active session tracking
   - Session revocation
   - Session cleanup

4. **Auth API Routes**
   - `POST /api/auth/login` - Login with JWT
   - `POST /api/auth/refresh` - Refresh token
   - `POST /api/auth/logout` - Logout
   - `POST /api/auth/mfa/enable` - Enable MFA
   - `POST /api/auth/mfa/verify` - Verify MFA

5. **Update Main Auth**
   - Update `src/lib/auth.ts` to use JWT
   - Remove cookie-based auth
   - Add JWT validation middleware

6. **RBAC Updates**
   - Add OWNER_ADMIN role
   - Add ORG_ADMIN role
   - Update role enum
   - Add role seed data

### Medium Priority
7. **Permission Caching**
   - Cache user permissions
   - Invalidate on role change
   - Redis integration (optional)

8. **Rate Limiting**
   - Auth endpoint rate limiting
   - Per-IP tracking
   - Per-user tracking

9. **Security Events**
   - Log all auth events
   - Failed login tracking
   - Token revocation logging

---

## 🧪 Testing Checklist

### Auth Testing
- [ ] JWT generation works
- [ ] JWT validation works
- [ ] Refresh token rotation works
- [ ] Account lockout triggers after 5 failures
- [ ] Account unlocks after 30 minutes
- [ ] MFA setup flow works
- [ ] MFA verification works
- [ ] Password reset flow works
- [ ] Session revocation works

### Security Testing
- [ ] Tokens expire correctly
- [ ] Revoked tokens are rejected
- [ ] Rate limiting works
- [ ] CORS is enforced
- [ ] Security headers are set

---

## 📚 Documentation

- `SECURITY_SCAN_REPORT.md` - Initial security scan
- `SECURITY_IMPLEMENTATION_GUIDE.md` - This file
- `PHASE1_IMPLEMENTATION_STATUS.md` - Phase 1 progress
- `SECURITY.md` - Threat model (TODO)
- `README_SECURITY_SETUP.md` - Setup guide (TODO)

---

## ⚠️ Important Notes

1. **JWT_SECRET**: Must be at least 32 characters, use strong random string
2. **HTTPS**: Required in production for secure token transmission
3. **Token Storage**: Never store tokens in localStorage (use httpOnly cookies or secure storage)
4. **Migration**: Run migration before generating Prisma client
5. **Backup**: Backup database before running migration

---

## 🆘 Troubleshooting

### Migration Fails
- Check PostgreSQL version (requires 12+)
- Check database permissions
- Verify DATABASE_URL is correct

### Prisma Generate Fails
- Run migration first
- Check schema syntax
- Clear Prisma cache: `rm -rf node_modules/.prisma`

### JWT Errors
- Verify JWT_SECRET is set
- Check token expiration
- Verify issuer/audience match

---

## 📞 Next Steps

1. **Complete Phase 1** (Auth + RBAC)
   - Implement remaining auth features
   - Test thoroughly
   - Deploy to staging

2. **Begin Phase 2** (Licensing)
   - Implement entitlement system
   - Add device binding
   - Test license validation

3. **Continue with Phases 3-5**
   - Admin console
   - Client hardening
   - API security

---

**Last Updated:** 2024
**Status:** Phase 1 - 40% Complete
