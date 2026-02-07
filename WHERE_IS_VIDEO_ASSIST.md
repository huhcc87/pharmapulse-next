# Where is the Video Assist Feature?

## Location

The **Video Assist** button is located in the **POS Terminal** page, in the **top header area**.

## How to Find It

### Step 1: Navigate to POS Terminal
1. Open your browser
2. Go to: `http://localhost:3000/pos`
3. Or click "Go to POS" from the homepage

### Step 2: Look in the Header
The Video Assist button is in the **top-right area** of the POS page, in the same row as other action buttons:

**Button Order (left to right):**
1. ⭐ Favorites button
2. 📈 Fast-moving button  
3. 👤 Select Customer button
4. 📦 Drug Library button
5. **🎥 Video Assist button** ← **HERE IT IS!**
6. 🔄 Repeat Invoice button

## What It Looks Like

- **Icon**: Video camera icon (🎥)
- **Text**: "Video Assist"
- **Color**: Blue button (when available) or gray (when disabled)
- **Indicator**: Green dot in top-right corner when staff is available

## When It Appears

The Video Assist button will **only show** when:
- ✅ You are **logged in** (authenticated)
- ✅ Auth check is complete (`isAuthReady` is true)
- ✅ User data is available

## If You Don't See It

### Check 1: Are you logged in?
- Make sure you're authenticated
- Try logging in at `/login`
- Check if other authenticated features work

### Check 2: Check browser console
1. Press `F12` to open DevTools
2. Go to Console tab
3. Look for any errors related to:
   - `useAuth`
   - `VideoAssistButton`
   - Authentication

### Check 3: Check the code location
The button is rendered at line **576-592** in:
```
src/app/pos/page.tsx
```

## Visual Guide

```
┌─────────────────────────────────────────────────────────┐
│  POS Terminal                                    [Header] │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [⭐ Favorites] [📈 Fast] [👤 Customer] [📦 Library]     │
│  [🎥 Video Assist] [🔄 Repeat]                           │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Search products or scan barcode...             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
│  [Cart Items]                                            │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

## Quick Access

**Direct URL:**
```
http://localhost:3000/pos
```

**Keyboard Shortcut:**
- Press `Alt + 2` to navigate to POS (if shortcuts are enabled)

## Button States

1. **Available (Blue)**: Staff is available, ready to initiate call
2. **Unavailable (Gray)**: No staff available, but button still works
3. **Calling (Gray)**: Call is in progress
4. **Hidden**: Not logged in or auth not ready

## What Happens When You Click

1. Button initiates a video call request
2. Sends context data (cart items, customer, total amount)
3. Finds available staff (owner/pharmacist/admin)
4. Creates a call log entry
5. Opens video call window (if connected)

## Troubleshooting

**Button not showing?**
- Check if you're logged in
- Check browser console for errors
- Verify auth cookies are set

**Button disabled?**
- Check if a call is already in progress
- Check availability status in console
- Try refreshing the page

**Button not working?**
- Check network tab for API errors
- Verify `/api/video-assist/initiate` endpoint
- Check if VideoCallLog table exists in database
