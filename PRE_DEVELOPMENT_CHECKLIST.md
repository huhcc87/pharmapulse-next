# Pre-Development Checklist ✅

**Before starting development, ensure all these items are set up!**

---

## 📋 Prerequisites

### 1. System Requirements ✅
- [ ] **Node.js 18.x or later** installed
  ```bash
  node --version  # Should be 18.x or higher
  ```
- [ ] **npm or yarn** installed
  ```bash
  npm --version
  ```
- [ ] **PostgreSQL database** accessible (local or Supabase cloud)

---

## 🔧 Setup Steps

### 2. Install Dependencies ✅
```bash
cd pharmapulse-next
npm install
```

**Verify:**
- [ ] `node_modules/` folder exists
- [ ] No installation errors
- [ ] All packages installed successfully

---

### 3. Environment Variables Setup 🔑

**Create `.env.local` file in project root:**

```bash
# Required for Authentication
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Required for Database
DATABASE_URL=postgresql://user:password@localhost:5432/pharmapulse?schema=public

# Optional: For Admin Features
ADMIN_MASTER_SECRET=your-super-secret-key-here
ADMIN_MASTER_CODE=YOUR_SECRET_ADMIN_CODE_HERE

# Optional: For AI Features
OPENAI_API_KEY=your-openai-api-key-here

# Optional: For Payments
NEXT_PUBLIC_RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-stripe-key
STRIPE_SECRET_KEY=your-stripe-secret

# Optional: For WhatsApp Integration
WHATSAPP_API_KEY=your-whatsapp-api-key
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id

# Optional: For E-Invoice/E-Way Bill
EINVOICE_API_KEY=your-einvoice-api-key
EINVOICE_USERNAME=your-einvoice-username
EWAYBILL_API_KEY=your-ewaybill-api-key

# Development
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Quick Setup:**
1. [ ] Create `.env.local` file in `pharmapulse-next/` directory
2. [ ] Add all required variables (minimum: Supabase + Database)
3. [ ] Verify file is NOT committed to Git (check `.gitignore`)

**Get Supabase Credentials:**
1. [ ] Go to [Supabase Dashboard](https://app.supabase.com)
2. [ ] Create a new project (if not exists)
3. [ ] Go to **Settings → API**
4. [ ] Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
5. [ ] Copy **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Verify Environment Variables:**
```bash
npm run check:env
```

**Expected Output:**
```
✅ Configured:
   NEXT_PUBLIC_SUPABASE_URL: https://...
   NEXT_PUBLIC_SUPABASE_ANON_KEY: eyJ...
✅ All required environment variables are configured!
```

---

### 4. Database Setup 🗄️

#### Option A: Supabase (Recommended for Development)

1. [ ] **Create Supabase Project**
   - Go to https://app.supabase.com
   - Create new project
   - Wait for project to be ready (~2 minutes)

2. [ ] **Configure Database URL**
   - Go to **Settings → Database**
   - Copy **Connection String** (URI format)
   - Add to `.env.local` as `DATABASE_URL`

3. [ ] **Sync Database Schema**
   ```bash
   npm run db:sync
   ```
   This runs:
   - `npx prisma db push` (syncs schema to database)
   - `npx prisma generate` (generates Prisma client)

   **Verify:**
   - [ ] No migration errors
   - [ ] Prisma client generated successfully
   - [ ] Database tables created

4. [ ] **Restart Dev Server** (after db:sync)
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

#### Option B: Local PostgreSQL

1. [ ] **Install PostgreSQL** (if not installed)
   ```bash
   # macOS
   brew install postgresql
   brew services start postgresql
   
   # Ubuntu
   sudo apt-get install postgresql
   sudo systemctl start postgresql
   ```

2. [ ] **Create Database**
   ```bash
   createdb pharmapulse
   ```

3. [ ] **Update DATABASE_URL in `.env.local`**
   ```bash
   DATABASE_URL=postgresql://your-username:password@localhost:5432/pharmapulse?schema=public
   ```

4. [ ] **Sync Schema**
   ```bash
   npm run db:sync
   ```

---

### 5. Optional: Import Drug Library Data 💊

**If you want the 253,973 medicines database:**

1. [ ] **Verify CSV file exists:**
   - File: `Drugs list/2) Master Excel-india_allopathy_medicines_253973_fixed.csv`
   - Or set `DRUG_CSV_PATH` environment variable

2. [ ] **Run Import** (takes 5-10 minutes)
   ```bash
   npm run db:import-drug-library
   ```

3. [ ] **Verify Import**
   ```bash
   # Test search API
   curl "http://localhost:3000/api/drug-library/search?q=Crocin&limit=5"
   ```

**Expected:** Returns 5+ Crocin products

---

### 6. Verify Setup ✅

#### Test 1: Environment Variables
```bash
npm run check:env
```

#### Test 2: Database Connection
```bash
# Visit in browser (dev mode only)
http://localhost:3000/dev/env
```

#### Test 3: Start Dev Server
```bash
npm run dev
```

**Expected:**
- [ ] Server starts without errors
- [ ] No missing environment variable warnings
- [ ] Application loads at `http://localhost:3000`

#### Test 4: Database Health
```bash
# Visit in browser
http://localhost:3000/api/health/db
```

**Expected:** Returns `{ "status": "healthy" }` or similar

---

## 🚀 Ready to Develop!

### Quick Start Commands

```bash
# Start development server
npm run dev

# Check environment variables
npm run check:env

# Sync database schema
npm run db:sync

# Generate Prisma client
npm run db:generate

# Seed database (optional)
npm run db:seed

# Lint code
npm run lint

# Build for production
npm run build
```

---

## 🔍 Troubleshooting

### Issue: "Missing environment variables"
**Solution:**
1. Check `.env.local` file exists in project root
2. Verify variable names are correct (case-sensitive)
3. Restart dev server after adding variables

### Issue: "Database connection failed"
**Solution:**
1. Check `DATABASE_URL` in `.env.local`
2. Verify PostgreSQL is running
3. Test connection: `psql $DATABASE_URL`

### Issue: "Prisma client not generated"
**Solution:**
```bash
npx prisma generate
```

### Issue: "Schema out of sync"
**Solution:**
```bash
npm run db:sync
# Then restart dev server
```

---

## 📚 Additional Documentation

- **Supabase Setup:** `SUPABASE_SETUP.md`
- **Environment Variables:** `ENV_SETUP_ADMIN.md`
- **Database Setup:** `README.md` → Database Management
- **Drug Library:** `QUICK_START.md`
- **Troubleshooting:** `TROUBLESHOOTING.md`

---

## ✅ Final Checklist

Before starting development, ensure:

- [ ] Node.js 18+ installed
- [ ] Dependencies installed (`npm install`)
- [ ] `.env.local` file created with all required variables
- [ ] Supabase project created and credentials added
- [ ] Database schema synced (`npm run db:sync`)
- [ ] Dev server starts successfully (`npm run dev`)
- [ ] Application loads at `http://localhost:3000`
- [ ] (Optional) Drug library data imported

---

**Status:** ✅ Ready for Development!

**Next Steps:**
1. Start developing features
2. Test locally at `http://localhost:3000`
3. Use `/dev/env` to check environment status
4. Check `CODEBASE_VERIFICATION_REPORT.md` for feature status

---

**Last Updated:** January 2026
