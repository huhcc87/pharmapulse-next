# Razorpay Payment Integration Setup Guide

This guide explains how to set up and test the Razorpay payment integration for the "Subscribe Yearly (₹15,000/year)" button.

## ⚠️ Important Notes

### Database Architecture
- The codebase uses **Prisma** for most database operations
- However, the Razorpay integration uses **Supabase database tables** (subscriptions, payment_events)
- These tables need to be created in your Supabase database using the SQL migration
- The API routes use Supabase client (`.from()`) for these tables, not Prisma

### Authentication
- The codebase currently uses cookie-based auth via `getSessionUser()`
- The Razorpay routes use `getSupabaseUser()` which adapts `getSessionUser()` for compatibility
- For full Supabase auth, you may need to install `@supabase/ssr` and use `createRouteHandlerClient`
- The user ID from `getSessionUser()` needs to match Supabase `auth.users(id)` format (UUID)

## Setup Steps

### 1. Run Supabase SQL Migration

1. Go to your Supabase Dashboard → SQL Editor
2. Open the file: `supabase/migrations/001_create_subscriptions_tables.sql`
3. Copy and paste the SQL into the SQL Editor
4. Click "Run" to execute

This creates:
- `subscriptions` table (with RLS policies)
- `payment_events` table (for audit logs)
- Indexes and triggers

### 2. Configure Razorpay Keys

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Navigate to Settings → API Keys
3. For testing, use **Test Mode** keys
4. Copy your **Key ID** and **Key Secret**

5. Add to `.env.local`:
```bash
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_test_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Restart Dev Server

After adding environment variables:
```bash
# Stop server (Ctrl+C)
npm run dev
```

### 4. Test the Integration

1. Go to Settings page → Billing tab
2. Click "Subscribe Yearly (₹15,000/year)" button
3. Razorpay checkout should open
4. Use Razorpay test cards:
   - Card: `4111 1111 1111 1111`
   - CVV: Any 3 digits
   - Expiry: Any future date
   - Name: Any name

5. After successful payment, the subscription should activate

## Testing in Razorpay Test Mode

### Test Cards
- **Success**: `4111 1111 1111 1111`
- **Failure**: `4000 0000 0000 0002`
- CVV: Any 3 digits
- Expiry: Any future date (e.g., 12/25)

### Test UPI IDs
- `success@razorpay`
- `failure@razorpay`

### Test Net Banking
- Select any bank (test mode)

## API Routes

### POST `/api/billing/create-order`
- Creates Razorpay order (₹15,000)
- Creates subscription record (status: inactive)
- Logs payment event
- Returns: `{ orderId, amount, currency, keyId, planCode }`

### POST `/api/billing/verify`
- Verifies Razorpay payment signature
- Activates subscription (status: active)
- Sets period dates (1 year from now)
- Logs payment verification
- Returns: `{ success: true, subscription }`

## Troubleshooting

### "Razorpay keys not configured"
- Check `.env.local` has `NEXT_PUBLIC_RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
- Restart dev server after adding env vars

### "Authentication required"
- Make sure you're logged in
- Check that cookies are set (Supabase session or app cookies)

### "Subscription record not found"
- Check that SQL migration ran successfully
- Verify tables exist in Supabase: `subscriptions`, `payment_events`
- Check RLS policies allow your user to read/write

### "Payment verification failed"
- Check that `RAZORPAY_KEY_SECRET` matches the key used to create the order
- Verify signature calculation (HMAC SHA256)

### Database Connection Issues
- If using Supabase as PostgreSQL provider, ensure `DATABASE_URL` points to Supabase
- If tables don't appear in Prisma Studio, that's expected - they're Supabase tables
- Use Supabase Table Editor to view `subscriptions` and `payment_events` tables

## Files Created/Modified

1. `.env.example` - Added Razorpay env vars
2. `supabase/migrations/001_create_subscriptions_tables.sql` - Database schema
3. `src/lib/razorpay/get-user.ts` - Auth helper
4. `src/lib/razorpay/checkout.ts` - Razorpay checkout utility
5. `src/app/api/billing/create-order/route.ts` - Create order endpoint
6. `src/app/api/billing/verify/route.ts` - Verify payment endpoint
7. `src/app/settings/page.tsx` - Updated subscribe button handler (see next steps)

## Next Steps

The settings page (`src/app/settings/page.tsx`) needs to be updated to:
1. Import `openRazorpayCheckout` from `@/lib/razorpay/checkout`
2. Update `handleSubscribeYearly` to:
   - Call `/api/billing/create-order`
   - Use `openRazorpayCheckout` with order details
   - On success callback, call `/api/billing/verify`
   - Refresh billing status
3. Make payment method chips clickable (optional enhancement)

## User ID Compatibility Note

The current implementation uses `getSessionUser()` which returns a string userId.
Supabase `auth.users(id)` uses UUID format. You may need to:
1. Convert userId to UUID format, OR
2. Create a mapping table, OR
3. Use Supabase auth directly (install `@supabase/ssr`)

This depends on your authentication architecture.
