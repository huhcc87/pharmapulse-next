# Supabase Setup Guide - Production Ready

Complete guide for setting up Supabase with PharmaPulse in a secure, production-ready manner.

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Variables](#environment-variables)
3. [Client vs Server Usage](#client-vs-server-usage)
4. [Security Best Practices](#security-best-practices)
5. [Testing Your Setup](#testing-your-setup)
6. [Row Level Security (RLS)](#row-level-security-rls)
7. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Step 1: Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click **"New Project"**
3. Fill in:
   - **Name**: `pharmapulse` (or your choice)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
4. Click **"Create new project"**
5. Wait ~2 minutes for project to be ready

### Step 2: Get Your Credentials

1. In your Supabase project, go to **Settings** (⚙️) → **API**
2. Copy these values:

   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** key: `eyJhbGc...` (long string starting with `eyJ`)
   - **service_role** key: `eyJhbGc...` (different long string) ⚠️ **Keep this secret!**

### Step 3: Configure Environment Variables

Create `.env.local` in project root (same level as `package.json`):

```bash
# Required: Authentication (Public - Safe for Browser)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key

# Optional: Admin Operations (Server-Only - NEVER expose to browser!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key
```

**⚠️ Security Note:**
- `NEXT_PUBLIC_*` variables are exposed to the browser (OK for URL and anon key)
- `SUPABASE_SERVICE_ROLE_KEY` must NEVER have `NEXT_PUBLIC` prefix
- Never commit `.env.local` to Git (it's already in `.gitignore`)

### Step 4: Restart Dev Server

```bash
# Stop server (Ctrl+C)
npm run dev
```

### Step 5: Verify Setup

```bash
# Check environment variables
npm run check:env

# Visit health check (in browser)
http://localhost:3000/api/supabase/health
```

---

## 🔑 Environment Variables

### Required Variables

| Variable | Description | Where to Find | Browser Safe? |
|----------|-------------|---------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Settings → API → Project URL | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anonymous key | Settings → API → anon public | ✅ Yes |

### Optional Variables

| Variable | Description | Where to Find | Browser Safe? |
|----------|-------------|---------------|---------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key (bypasses RLS) | Settings → API → service_role | ❌ **NEVER** |

### Where to Find Values

1. Go to your Supabase project
2. Navigate to **Settings** (⚙️) → **API**
3. You'll see:
   ```
   Project URL: https://xxxxx.supabase.co
   Project API keys:
   - anon public: eyJhbGc...
   - service_role: eyJhbGc... ⚠️ Keep secret!
   ```

---

## 💻 Client vs Server Usage

### Browser/Client-Side Code

**Use:** `@/lib/supabase/client`

```tsx
// ✅ Correct: Client Component
"use client";

import { supabase } from "@/lib/supabase/client";

export default function MyComponent() {
  const handleClick = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*');
  };
  
  return <button onClick={handleClick}>Load Products</button>;
}
```

**Characteristics:**
- Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Respects Row Level Security (RLS)
- Auto-refreshes auth tokens
- Persists session in browser

### Server-Side Code (API Routes, Server Components)

**Use:** `@/lib/supabase/server`

```ts
// ✅ Correct: API Route
import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('products')
    .select('*');
  
  return NextResponse.json({ data, error });
}
```

**Characteristics:**
- Uses anon key (respects RLS)
- No session persistence
- No auto-refresh
- Better for server-side operations

### Admin Operations (Server-Only)

**Use:** `createAdminClient()` from `@/lib/supabase/server`

```ts
// ✅ Correct: Admin operation (server-only)
import { createAdminClient } from "@/lib/supabase/server";

export async function adminOperation() {
  const admin = createAdminClient();
  
  // ⚠️ This bypasses RLS - use with caution!
  const { data } = await admin
    .from('users')
    .select('*');
}
```

**When to use:**
- User management (create/update/delete users)
- System maintenance
- Background jobs
- Operations that must bypass RLS

**⚠️ Warning:**
- NEVER use in client-side code
- NEVER expose to browser
- Only use when absolutely necessary
- Always validate permissions manually

---

## 🔒 Security Best Practices

### ✅ DO

1. **Use anon key in client-side code** - It respects RLS
2. **Use service role key only in server-side code** - Never in browser
3. **Enable RLS on all tables** - Enforce security at database level
4. **Use environment variables** - Never hardcode keys
5. **Validate environment variables** - Fail fast with helpful errors

### ❌ DON'T

1. **Never use service role key in client code** - It bypasses RLS
2. **Never expose service role key to browser** - Keep it server-only
3. **Never commit `.env.local` to Git** - It's in `.gitignore`
4. **Never hardcode keys in source code** - Use environment variables
5. **Never skip RLS** - Always enable Row Level Security

### Security Checklist

- [ ] ✅ `NEXT_PUBLIC_SUPABASE_URL` is set (safe for browser)
- [ ] ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set (safe for browser)
- [ ] ✅ `SUPABASE_SERVICE_ROLE_KEY` is set (server-only)
- [ ] ✅ `SUPABASE_SERVICE_ROLE_KEY` does NOT have `NEXT_PUBLIC` prefix
- [ ] ✅ `.env.local` is in `.gitignore`
- [ ] ✅ RLS is enabled on all tables
- [ ] ✅ No hardcoded keys in source code

---

## 🧪 Testing Your Setup

### Test 1: Health Check

```bash
curl http://localhost:3000/api/supabase/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "message": "Supabase is properly configured",
  "hasServiceRole": true,
  "urlHost": "xxxxx.supabase.co",
  "timestamp": "2026-01-18T..."
}
```

### Test 2: Smoke Test (Requires `products` table)

```bash
curl http://localhost:3000/api/products/test
```

**Expected Response:**
```json
{
  "ok": true,
  "message": "Supabase connection test successful!",
  "inserted": { ... },
  "latest": [ ... ],
  "timestamp": "2026-01-18T..."
}
```

**If you get an error:**
- Make sure the `products` table exists in Supabase
- Check RLS policies allow INSERT and SELECT
- See [Troubleshooting](#troubleshooting) section

### Test 3: List Products

```bash
curl http://localhost:3000/api/supabase/list
```

**Expected Response:**
```json
{
  "ok": true,
  "count": 0,
  "data": []
}
```

### Visual Health Check (Dev Only)

Visit: `http://localhost:3000/dev/env`

Shows visual status of environment variables (development only).

---

## 🔐 Row Level Security (RLS)

### What is RLS?

Row Level Security is a PostgreSQL feature that enforces security at the database level. It ensures users can only access data they're allowed to see.

### Enable RLS

1. Go to Supabase Dashboard → **Table Editor**
2. Select your table (e.g., `products`)
3. Click **"Enable RLS"** toggle
4. Create policies as needed

### Example RLS Policy

**Policy: "Anyone can read products"**

```sql
-- Allow anonymous users to read products
CREATE POLICY "Allow public read access"
ON products
FOR SELECT
TO anon
USING (true);
```

**Policy: "Only authenticated users can insert"**

```sql
-- Allow authenticated users to insert
CREATE POLICY "Allow authenticated insert"
ON products
FOR INSERT
TO authenticated
WITH CHECK (true);
```

### Recommended RLS Policies

For development/testing, you can start with permissive policies:

```sql
-- Allow anonymous read (public access)
CREATE POLICY "public_read"
ON products FOR SELECT
TO anon
USING (true);

-- Allow authenticated write
CREATE POLICY "authenticated_write"
ON products FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_update"
ON products FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "authenticated_delete"
ON products FOR DELETE
TO authenticated
USING (true);
```

For production, create more restrictive policies based on user roles and data ownership.

---

## 🐛 Troubleshooting

### Error: "Missing required environment variable"

**Problem:** Environment variables not set

**Solution:**
1. Check `.env.local` exists in project root
2. Verify variable names match exactly (case-sensitive)
3. Restart dev server after adding variables
4. Run `npm run check:env` to verify

### Error: "Invalid NEXT_PUBLIC_SUPABASE_URL format"

**Problem:** URL format is incorrect

**Solution:**
1. Ensure URL starts with `https://`
2. Format: `https://xxxxx.supabase.co`
3. No trailing slash
4. Copy directly from Supabase Dashboard

### Error: "relation 'products' does not exist"

**Problem:** Table doesn't exist in Supabase database

**Solution:**
1. Go to Supabase Dashboard → SQL Editor
2. Create the table:
   ```sql
   CREATE TABLE products (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     brand_name TEXT NOT NULL,
     manufacturer TEXT,
     category TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```
3. Or use Prisma migrations: `npm run db:sync`

### Error: "permission denied for table products"

**Problem:** RLS is enabled but no policies allow access

**Solution:**
1. Go to Supabase Dashboard → Table Editor → products
2. Check **"Enable RLS"** is on
3. Go to **"Policies"** tab
4. Create a policy allowing access (see [RLS section](#row-level-security-rls))

### Service Role Key Not Working

**Problem:** `SUPABASE_SERVICE_ROLE_KEY` errors

**Check:**
1. Variable name is exactly `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC` prefix)
2. Value is the `service_role` key from Supabase Dashboard
3. Only used in server-side code (API routes, server components)
4. Never used in client-side code

### Connection Works But RLS Blocks Operations

**Problem:** Operations fail with RLS errors

**Solution:**
- For testing: Create permissive RLS policies (see [RLS section](#row-level-security-rls))
- For production: Create proper policies based on user roles
- For admin operations: Use `createAdminClient()` (server-only)

---

## 📚 Code Examples

### Client Component Example

```tsx
"use client";

import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export default function ProductsList() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    async function loadProducts() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .limit(10);

      if (error) {
        console.error('Error:', error);
        return;
      }

      setProducts(data || []);
    }

    loadProducts();
  }, []);

  return (
    <div>
      {products.map(product => (
        <div key={product.id}>{product.brand_name}</div>
      ))}
    </div>
  );
}
```

### API Route Example

```ts
import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .limit(10);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

### Admin Operation Example

```ts
import { createAdminClient } from "@/lib/supabase/server";

// ⚠️ Server-only function
export async function createUser(email: string, password: string) {
  const admin = createAdminClient();
  
  // This bypasses RLS - use with caution!
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }

  return data;
}
```

---

## ✅ Verification Checklist

Before starting development:

- [ ] ✅ Supabase project created
- [ ] ✅ `.env.local` created with `NEXT_PUBLIC_SUPABASE_URL`
- [ ] ✅ `.env.local` has `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] ✅ Optional: `SUPABASE_SERVICE_ROLE_KEY` added (server-only)
- [ ] ✅ `npm run check:env` passes
- [ ] ✅ Health check endpoint works (`/api/supabase/health`)
- [ ] ✅ Smoke test passes (`/api/products/test`) - requires table
- [ ] ✅ RLS policies configured (if using tables)
- [ ] ✅ No hardcoded keys in source code
- [ ] ✅ `.env.local` is in `.gitignore`

---

## 📖 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Next.js Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase TypeScript Types](https://supabase.com/docs/guides/api/generating-types)

---

**Last Updated:** January 2026  
**Status:** ✅ Production Ready
