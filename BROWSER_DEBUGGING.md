# Browser Debugging Guide - MR Drug Library

## 🔍 How to Check in Browser

### Step 1: Open Browser Developer Tools
- **Chrome/Edge**: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
- **Firefox**: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
- **Safari**: Enable Developer menu first: Preferences > Advanced > Show Develop menu, then `Cmd+Option+I`

### Step 2: Check Network Tab
1. Open **Network** tab in DevTools
2. Clear existing requests (trash icon)
3. Try searching in the MR Drug Library modal
4. Look for request to `/api/drug-library/search`
5. Click on the request to see:
   - **Request URL**: Should be `/api/drug-library/search?q=crocin&limit=50`
   - **Status Code**: Should be `200` (green)
   - **Response**: Click "Response" tab to see JSON

### Step 3: Check Console Tab
1. Open **Console** tab
2. Look for error messages (red text)
3. Common errors:
   - `Failed to fetch` = API endpoint not found
   - `404` = Route doesn't exist
   - `500` = Server error (check server logs)

### Step 4: Test API Directly in Browser
Open these URLs directly in browser:

```
# Health check
http://localhost:3000/api/drug-library/health

# Search for Crocin
http://localhost:3000/api/drug-library/search?q=crocin&limit=5

# Search for Augmentin
http://localhost:3000/api/drug-library/search?q=augmentin&limit=5

# QR lookup
http://localhost:3000/api/drug-library/by-qr?code=INMED-000001
```

## 🐛 Common Issues & Fixes

### Issue 1: "Failed to search drug library"
**Check:**
1. Open Network tab → Find `/api/drug-library/search` request
2. Check Status Code:
   - **404**: Route file missing or wrong path
   - **500**: Server error (check terminal/console)
   - **CORS error**: Check Next.js is running

**Fix:**
- Check server terminal for error messages
- Verify route file exists: `src/app/api/drug-library/search/route.ts`
- Restart dev server: `npm run dev`

### Issue 2: Search returns empty results
**Check:**
1. Open Network tab → Click on search request
2. Check Response tab → Should see JSON with `results` array
3. If `results: []` and `total: 0`:
   - Data might not be imported
   - Check health endpoint: `/api/drug-library/health`

**Fix:**
```bash
# Check if data exists
curl http://localhost:3000/api/drug-library/health

# If rowCount is 0, import data:
npm run db:import-drug-library
```

### Issue 3: "Validation error" in QR lookup
**Check:**
1. Open Network tab → Find `/api/drug-library/by-qr` request
2. Check Request URL → Should have `?code=INMED-000001` or `?qrCode=INMED-000001`
3. Check Response → Should see error message

**Fix:**
- Ensure QR code format: `INMED-000001` (uppercase, 6 digits)
- Check API accepts both `code` and `qrCode` parameters

### Issue 4: Add to Inventory fails
**Check:**
1. Open Network tab → Find `/api/inventory/add-from-library` request
2. Check Request Payload → Should have `drugLibraryId` or `qrCode`
3. Check Response → Should see error message

**Fix:**
- Ensure `drugLibraryId` is a number (not string)
- Check `tenantId` and `branchId` are provided
- Verify drug exists: Check search results include `id` field

## 📊 Expected API Responses

### Health Check Response
```json
{
  "healthy": true,
  "rowCount": 253973,
  "hasQrColumns": true,
  "sampleRow": {
    "brandName": "Augmentin 625 Duo Tablet",
    "qrCode": "INMED-000001"
  }
}
```

### Search Response
```json
{
  "results": [
    {
      "id": 1,
      "brandName": "Augmentin 625 Duo Tablet",
      "manufacturer": "Glaxo SmithKline Pharmaceuticals Ltd",
      "salts": "Amoxycillin, Clavulanic Acid",
      "qrCode": "INMED-000001",
      ...
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

### QR Lookup Response
```json
{
  "success": true,
  "found": true,
  "drug": {
    "id": 1,
    "brandName": "Augmentin 625 Duo Tablet",
    "qrCode": "INMED-000001",
    ...
  }
}
```

## 🧪 Quick Test Commands

### In Browser Console
```javascript
// Test search
fetch('/api/drug-library/search?q=crocin&limit=5')
  .then(r => r.json())
  .then(console.log);

// Test QR lookup
fetch('/api/drug-library/by-qr?code=INMED-000001')
  .then(r => r.json())
  .then(console.log);

// Test health
fetch('/api/drug-library/health')
  .then(r => r.json())
  .then(console.log);
```

### In Terminal
```bash
# Health check
curl http://localhost:3000/api/drug-library/health

# Search
curl "http://localhost:3000/api/drug-library/search?q=crocin&limit=5"

# QR lookup
curl "http://localhost:3000/api/drug-library/by-qr?code=INMED-000001"
```

## ✅ Verification Checklist

- [ ] Health endpoint returns `rowCount: 253973`
- [ ] Search endpoint returns results for "crocin"
- [ ] Search endpoint returns results for "augmentin"
- [ ] QR lookup works for "INMED-000001"
- [ ] No console errors in browser
- [ ] Network requests show status 200
- [ ] Response JSON has correct structure

