# How to Open Browser and Access PharmaPulse

## Quick Start

### Step 1: Start the Development Server

Open your terminal and run:

```bash
cd pharmapulse-next
npm run dev
```

Wait for the message:
```
✓ Ready on http://localhost:3000
```
or
```
✓ Ready on http://localhost:3001
```

### Step 2: Open in Browser

**Option A: Automatic (macOS)**
```bash
open http://localhost:3000
```

**Option B: Manual**
1. Open your web browser (Chrome, Firefox, Safari, or Edge)
2. Type in the address bar:
   ```
   http://localhost:3000
   ```
   or if port 3000 is busy:
   ```
   http://localhost:3001
   ```

**Option C: Click the link**
- Look in your terminal for the "Local:" URL
- Hold `Cmd` (Mac) or `Ctrl` (Windows) and click the link

## What You Should See

- **Homepage**: PharmaPulse AI with blue heading
- **Links**: "Go to POS", "Dashboard", "Inventory", "Sign In"

## Troubleshooting

### If you see "Port 3000 is in use"
The server will automatically use port 3001. Use:
```
http://localhost:3001
```

### If the page doesn't load
1. Check terminal for errors
2. Make sure server is running (you should see "Ready on...")
3. Try hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

### If you see a blank page
1. Open browser DevTools (F12 or Cmd+Option+I)
2. Check Console tab for errors
3. Check Network tab for failed requests

## Quick Commands

**Start server:**
```bash
cd pharmapulse-next
npm run dev
```

**Open browser automatically (Mac):**
```bash
open http://localhost:3000
```

**Open browser automatically (Windows):**
```bash
start http://localhost:3000
```

**Open browser automatically (Linux):**
```bash
xdg-open http://localhost:3000
```

## Common URLs

- Homepage: `http://localhost:3000`
- POS: `http://localhost:3000/pos`
- Dashboard: `http://localhost:3000/dashboard`
- Login: `http://localhost:3000/login`
- Register: `http://localhost:3000/register`
- Inventory: `http://localhost:3000/inventory`
