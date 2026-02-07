# Next.js 15 Upgrade Status

## ✅ Completed

1. **Package.json Updated**
   - Next.js: `^14.2.0` → `^15.0.0`
   - React: `^18.2.0` → `^19.0.0`
   - React DOM: `^18.2.0` → `^19.0.0`
   - @types/react: `^18.2.64` → `^19.0.0`
   - @types/react-dom: `^18.2.21` → `^19.0.0`
   - eslint-config-next: `^16.1.1` → `^15.0.0` (latest)

2. **Async API Calls Fixed**
   - ✅ `lib/auth/context.ts` - `headers()` now awaited
   - ✅ `lib/auth.ts` - `cookies()` already awaited
   - ✅ `lib/licensing/device-id.ts` - `cookies()` already awaited
   - ✅ `app/api/auth/login/route.ts` - `cookies()` already awaited
   - ✅ `app/api/auth/setup/route.ts` - `cookies()` already awaited
   - ✅ `app/api/pos/drafts/[id]/route.ts` - `params` now Promise and awaited
   - ✅ `app/api/invoices/[id]/issue/route.ts` - `params` already Promise and awaited
   - ✅ `app/api/invoices/[id]/route.ts` - `params` already Promise and awaited
   - ✅ `app/api/customers/[id]/route.ts` - `params` already Promise and awaited
   - ✅ `app/api/adherence/[id]/route.ts` - `params` already Promise and awaited

## ⚠️ Remaining Work

### Dynamic Route Params (29 files need updating)

The following files need their `params` updated from `{ params: { id: string } }` to `{ params: Promise<{ id: string }> }` and then `await params`:

- `app/api/hsn/[id]/route.ts`
- `app/api/patient-portal/reminders/[id]/mark-taken/route.ts`
- `app/api/deliveries/[id]/confirm/route.ts`
- `app/api/deliveries/[id]/track/route.ts`
- `app/api/billing/payment-methods/[id]/set-default/route.ts`
- `app/api/billing/payment-methods/[id]/route.ts`
- `app/api/billing/payment-methods/[id]/verify/route.ts`
- `app/api/i18n/invoice/[id]/route.ts`
- `app/api/users/[id]/route.ts`
- `app/api/inventory/items/[id]/route.ts`
- `app/api/drug-library/[id]/hsn/route.ts`
- `app/api/print/jobs/[id]/route.ts`
- `app/api/drugs/[id]/batches/route.ts`
- `app/api/invoices/[id]/route.ts` ✅ (already fixed)
- `app/api/invoices/[id]/record-payment/route.ts`
- `app/api/invoices/[id]/e-invoice/generate/route.ts`
- `app/api/invoices/[id]/e-invoice/cancel/route.ts`
- `app/api/invoices/[id]/credit-note/route.ts`
- `app/api/invoices/[id]/e-waybill/generate/route.ts`
- `app/api/invoices/[id]/e-waybill/cancel/route.ts`
- `app/api/suppliers/performance/[id]/route.ts`
- `app/api/products/[id]/route.ts`
- `app/api/products/[id]/gst/route.ts`
- `app/api/adherence/[id]/route.ts` ✅ (already fixed)
- `app/api/payments/[id]/status/route.ts`
- `app/api/customers/[id]/route.ts` ✅ (already fixed)
- `app/api/pos/drafts/[id]/route.ts` ✅ (already fixed)
- `app/api/invoices/[id]/issue/route.ts` ✅ (already fixed)
- `app/api/invoices/[id]/pdf/route.ts`

### Pages with Params/SearchParams

Check pages for `params` and `searchParams` that need to be awaited:
- `app/drug-library/[id]/page.tsx`
- `app/dashboard/invoices/[id]/page.tsx`
- `app/pos/receipt/[id]/page.tsx`
- `app/drug-library/by-id/page.tsx`
- `app/invoices/[id]/print/page.tsx`

### Next Steps

1. **Run Next.js Codemod** (recommended):
   ```bash
   npx @next/codemod@canary upgrade latest
   ```
   This will automatically fix most async API calls.

2. **Manual Fixes** (if codemod doesn't cover everything):
   - Update all `params: { id: string }` to `params: Promise<{ id: string }>`
   - Add `const resolvedParams = await params` before using params
   - Update all `params.id` to `resolvedParams.id`

3. **Test the Application**:
   - Run `npm run dev` and test key routes
   - Check for TypeScript errors
   - Verify all API routes work correctly

## Breaking Changes Summary

1. **Async Request APIs**: `cookies()`, `headers()`, `draftMode()`, `params`, `searchParams` are now async
2. **React 19**: `useFormState` deprecated, replaced by `useActionState`
3. **Fetch Cache**: `fetch` requests no longer cached by default
4. **Route Handlers**: `GET` functions no longer cached by default

## References

- [Next.js 15 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-15)
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
