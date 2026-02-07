# Quick Start: Supabase Setup

**Goal:** Get Supabase working locally in 5 minutes

---

## Step 1: Get Supabase Credentials (2 minutes)

1. Go to [app.supabase.com](https://app.supabase.com)
2. Create/Select project
3. Go to **Settings** (⚙️) → **API**
4. Copy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** key: `eyJhbGc...`
   - **service_role** key: `eyJhbGc...` (optional, keep secret!)

---

## Step 2: Create .env.local (1 minute)

Create `.env.local` in project root:

```bash
# Required (browser-safe)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key

# Optional (server-only, NEVER use NEXT_PUBLIC prefix!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key
```

---

## Step 3: Restart Server (30 seconds)

```bash
# Stop server (Ctrl+C)
npm run dev
```

---

## Step 4: Verify (30 seconds)

```bash
# Option 1: Command line
npm run check:env

# Option 2: Browser
# Visit: http://localhost:3000/api/supabase/health

# Option 3: Visual (dev only)
# Visit: http://localhost:3000/dev/env
```

**Expected:** All green checkmarks ✅

---

## ✅ Done!

You're ready to use Supabase:

- **Client-side:** `import { supabase } from '@/lib/supabase/client'`
- **Server-side:** `import { createServerClient } from '@/lib/supabase/server'`
- **Admin (server-only):** `import { createAdminClient } from '@/lib/supabase/server'`

---

## 🧪 Test It

### Health Check
```bash
curl http://localhost:3000/api/supabase/health
```

### Smoke Test (requires `products` table)
```bash
curl http://localhost:3000/api/products/test
```

---

## 📚 Full Documentation

- **Complete Guide:** `SUPABASE_SETUP_GUIDE.md`
- **Implementation Details:** `SUPABASE_IMPLEMENTATION_SUMMARY.md`

---

## ⚠️ Common Issues

**Error: "Missing environment variables"**
→ Check `.env.local` exists and variable names match exactly

**Error: "relation 'products' does not exist"**
→ Create the table in Supabase or use Prisma: `npm run db:sync`

**Health check returns 503**
→ Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set

---

**Time to complete:** ~5 minutes  
**Status:** ✅ Production Ready
