# How to Start the Dev Server

## ✅ Quick Start

**Important:** You must be in the `pharmapulse-next` directory!

```bash
# Navigate to the correct directory
cd pharmapulse-next

# Start the dev server
npm run dev
```

## 📋 Step-by-Step

### 1. Navigate to Project Directory

```bash
cd /Users/mudasirrashid/Documents/Idea-Development-Pharmapl/pharmapulse-next
```

### 2. Verify You're in the Right Place

```bash
# Check if package.json exists
ls package.json

# Should show: package.json
```

### 3. Start Dev Server

```bash
npm run dev
```

**Expected Output:**
```
> pharmapulse-next@1.0.0 dev
> next dev --webpack

- ready started server on 0.0.0.0:3000, url: http://localhost:3000
- event compiled client and server successfully
```

### 4. Open in Browser

Visit: `http://localhost:3000`

---

## 🔍 Verify Setup

### Check Environment Variables

```bash
npm run check:env
```

**Expected:**
```
✅ Configured:
   NEXT_PUBLIC_SUPABASE_URL: https://pzaadwmncakcdphxzotd.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIs...xZx4

✅ All required environment variables are configured!
```

### Test Health Endpoint

Once server is running:

```bash
curl http://localhost:3000/api/supabase/health
```

Or visit: `http://localhost:3000/api/supabase/health`

### Test Environment Check Page

Visit: `http://localhost:3000/dev/env`

Should show green checkmarks ✅

---

## ❌ Common Errors

### Error: "Missing script: 'dev'"

**Problem:** You're in the wrong directory.

**Solution:**
```bash
# Make sure you're in pharmapulse-next directory
cd pharmapulse-next

# Then run
npm run dev
```

### Error: "Port 3000 is already in use"

**Solution:**
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Error: "Cannot find module"

**Solution:**
```bash
# Install dependencies
npm install

# Then start
npm run dev
```

---

## 🚀 Quick Commands Reference

```bash
# Start dev server
npm run dev

# Check environment variables
npm run check:env

# Build for production
npm run build

# Start production server
npm start

# Sync database schema
npm run db:sync
```

---

**Current Directory:** `/Users/mudasirrashid/Documents/Idea-Development-Pharmapl/pharmapulse-next`
