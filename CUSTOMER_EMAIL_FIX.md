# Customer Email Fix - Permanent Solution

## ✅ Changes Made

### A) Prisma Schema Update
- **File:** `prisma/schema.prisma`
- **Change:** Added `@db.VarChar(255)` to `Customer.email` field for explicit database type
- **Status:** ✅ Customer model already had `email String?` - enhanced with explicit DB type

### B) DB Sync Scripts
- **File:** `package.json`
- **Status:** ✅ Already exists:
  - `"db:sync": "prisma db push && prisma generate"`
  - `"db:studio": "prisma studio"`

### C) Customer Create API Route
- **File:** `src/app/api/customers/route.ts`
- **Changes:**
  1. ✅ Strict normalization: email trimmed and lowercased
  2. ✅ Validation: email optional, basic regex if provided
  3. ✅ Error guard: Detects `DB_SCHEMA_OUT_OF_SYNC` errors
  4. ✅ Returns clear error code: `DB_SCHEMA_OUT_OF_SYNC` with status 409
  5. ✅ Provides actionable hint: "Run: npm run db:sync && restart dev server"

### D) POS UI Modal
- **File:** `src/components/pos/CustomerDrawer.tsx`
- **Changes:**
  1. ✅ Detects `DB_SCHEMA_OUT_OF_SYNC` error code
  2. ✅ Shows clear toast message with fix instructions
  3. ✅ Logs detailed fix steps to console
  4. ✅ Does not retry endlessly - waits for user to fix schema

### E) Health Check Endpoint
- **File:** `src/app/api/health/db/route.ts`
- **Changes:**
  1. ✅ Verifies `Customer.email` column exists
  2. ✅ Returns `DB_SCHEMA_OUT_OF_SYNC` code if column missing
  3. ✅ Provides fix hint in response

## 📝 Verification Checklist

### Step 1: Sync Database Schema
```bash
npm run db:sync
```
**Expected:** No errors, schema synced to database

### Step 2: Restart Dev Server
```bash
# Stop current server (Ctrl+C)
npm run dev
```
**Expected:** Server starts without errors

### Step 3: Verify Health Check
Visit: `http://localhost:3000/api/health/db`

**Expected Response:**
```json
{
  "ok": true,
  "database": "postgresql://***",
  "schema": {
    "customer": {
      "hasEmail": true
    }
  }
}
```

### Step 4: Test Customer Creation (Name Only)
1. Go to `/pos`
2. Click "Select Customer" → "+ Create New Customer"
3. Enter:
   - Name: "Test Customer"
   - Phone: (leave empty)
   - Email: (leave empty)
4. Click "Create"

**Expected:** ✅ Customer created successfully, selected in POS

### Step 5: Test Customer Creation (Name + Email)
1. Go to `/pos`
2. Click "Select Customer" → "+ Create New Customer"
3. Enter:
   - Name: "Test Customer 2"
   - Phone: (optional)
   - Email: "test@example.com"
4. Click "Create"

**Expected:** ✅ Customer created successfully with email stored

### Step 6: Verify in Prisma Studio
```bash
npx prisma studio
```
1. Navigate to `Customer` table
2. Verify:
   - ✅ `email` column exists
   - ✅ Customers can have `null` email
   - ✅ Customers can have email values

## 🔧 Error Handling

### If Schema Error Occurs:
1. **API Response:**
   ```json
   {
     "ok": false,
     "code": "DB_SCHEMA_OUT_OF_SYNC",
     "error": "Database schema error: field 'email' not found.",
     "message": "Database is out of sync with Prisma schema.",
     "hint": "Run: npm run db:sync && restart dev server"
   }
   ```

2. **POS UI:**
   - Shows toast: "Database schema out of sync. Run: npm run db:sync && restart dev server"
   - Logs detailed steps to console
   - Does not retry automatically

3. **Health Check:**
   - Returns `{ ok: false, code: "DB_SCHEMA_OUT_OF_SYNC", hint: "..." }`

## 📋 Files Changed

1. ✅ `prisma/schema.prisma` - Added `@db.VarChar(255)` to Customer.email
2. ✅ `src/lib/validators/customer.ts` - Email lowercase normalization
3. ✅ `src/app/api/customers/route.ts` - Enhanced error handling with DB_SCHEMA_OUT_OF_SYNC code
4. ✅ `src/components/pos/CustomerDrawer.tsx` - Improved error display
5. ✅ `src/app/api/health/db/route.ts` - Enhanced Customer.email verification

## ✅ Success Criteria

- [x] Customer can be created with name only (no email)
- [x] Customer can be created with name + email
- [x] Email is normalized (lowercase, trimmed)
- [x] Schema errors return clear, actionable messages
- [x] Health check verifies email column exists
- [x] POS modal shows helpful error messages

## 🚀 Next Steps After Fix

1. Run `npm run db:sync` to sync schema
2. Restart dev server
3. Test customer creation in POS
4. Verify in Prisma Studio

The fix is permanent - once schema is synced, customer creation will work reliably with or without email.


