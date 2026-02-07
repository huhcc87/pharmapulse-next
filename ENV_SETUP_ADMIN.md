# Environment Variables Setup - Admin Licence Management

## Quick Setup

### Step 1: Copy Environment Template

```bash
cp .env.example .env.local
```

### Step 2: Add Admin Secrets

Open `.env.local` and add these **SECURE** admin variables:

```bash
# Admin Licence Management (SECURE - Only you should know these!)
ADMIN_MASTER_SECRET=your-super-secret-key-here
ADMIN_MASTER_CODE=YOUR_SECRET_ADMIN_CODE_HERE
```

### Step 3: Generate Secure Codes

**Generate ADMIN_MASTER_SECRET (64 characters):**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Generate ADMIN_MASTER_CODE (16 characters):**
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex').toUpperCase())"
```

### Step 4: Add Generated Codes

Copy the generated codes to your `.env.local`:

```bash
ADMIN_MASTER_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
ADMIN_MASTER_CODE=A1B2C3D4E5F6G7H8
```

### Step 5: Restart Server

```bash
# Stop server (Ctrl+C)
npm run dev
```

---

## Complete .env.local Example

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/pharmapulse?schema=public"

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Admin Licence Management (SECURE!)
ADMIN_MASTER_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
ADMIN_MASTER_CODE=A1B2C3D4E5F6G7H8

# Licence Key Generation
LICENCE_KEY_SECRET=your-licence-key-secret
RENEWAL_CODE_SECRET=your-renewal-code-secret

# Expiry Check Job
EXPIRY_CHECK_SECRET=your-expiry-check-secret

# Node Environment
NODE_ENV=development
```

---

## Production Setup

### For Vercel/Production:

1. Go to your deployment platform's environment variables settings
2. Add these variables:
   - `ADMIN_MASTER_SECRET` = (your generated secret)
   - `ADMIN_MASTER_CODE` = (your generated code)
   - `LICENCE_KEY_SECRET` = (your generated secret)
   - `RENEWAL_CODE_SECRET` = (your generated secret)
   - `EXPIRY_CHECK_SECRET` = (your generated secret)

3. **Never commit these to Git!** They should only be in:
   - `.env.local` (local development)
   - Production environment variables (deployment platform)

---

## Security Checklist

- ✅ Generated secure random codes
- ✅ Added to `.env.local` (not committed to Git)
- ✅ Added to production environment variables
- ✅ Never shared codes with anyone
- ✅ Different codes for dev/staging/prod
- ✅ Rotate codes every 90 days

---

## Verify Setup

Test that your admin codes work:

```bash
# Test admin access
curl -H "X-Admin-Code: YOUR_SECRET_ADMIN_CODE" \
  http://localhost:3000/api/admin/licences
```

If you get a list of licences (or empty array), your setup is correct!

---

## Troubleshooting

### "UNAUTHORIZED" Error

- Check that `ADMIN_MASTER_CODE` and `ADMIN_MASTER_SECRET` are set in `.env.local`
- Restart your dev server after adding variables
- Verify the code matches exactly (case-sensitive)

### Variables Not Loading

- Make sure file is named `.env.local` (not `.env`)
- Restart dev server: `npm run dev`
- Check for typos in variable names

---

## Next Steps

After setting up environment variables:

1. Read `ADMIN_SETUP_QUICK_START.md` for quick usage guide
2. Read `ADMIN_LICENCE_API_GUIDE.md` for complete API documentation
3. Start managing licences via the admin API!
