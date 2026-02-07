# Video Assist Call Controls Guide

## 🎥 Video Assist Feature - Complete Control Guide

### Overview
Video Assist allows Pharmacist and Owner accounts to initiate video calls for support during POS operations. The feature includes comprehensive call management controls.

---

## 🚀 How to Use Video Assist

### 1. **Initiating a Call**

1. **Locate the Video Assist Button**
   - Found in POS Terminal header (after "Drug Library" button)
   - Blue button with video camera icon
   - Shows "Video Assist" text

2. **Click to Start**
   - Click the "Video Assist" button
   - System finds available Pharmacist/Owner staff
   - Call status changes to "Ringing..."

3. **Call States**
   - **RINGING**: Waiting for staff to answer
   - **CONNECTED**: Call is active
   - **ENDED**: Call completed
   - **FAILED**: Call failed to connect

---

## 🎛️ Call Controls

### **Accessing Controls**
- When a call is active, click the **"Call Active"** button (red button)
- A control panel opens below the button

### **Control Panel Features**

#### 1. **Call Status Indicator**
- **Green dot**: Call connected
- **Yellow pulsing dot**: Call ringing
- **Gray dot**: Call ended/failed

#### 2. **Call Duration Timer**
- Shows elapsed time in format: `M:SS` (e.g., "2:35")
- Updates every second during active calls
- Only visible when call is CONNECTED

#### 3. **Participants List**
- Shows all participants in the call
- Displays role (Pharmacist, Owner, etc.)
- Shows join status (JOINED, INVITED, LEFT)

#### 4. **Control Buttons**

**🔴 Hang Up Button**
- **Function**: Ends the current call
- **Action**: 
  - Sends end signal to server
  - Closes video window (if open)
  - Clears call state
  - Shows "Call ended successfully" message
- **When to use**: 
  - Call completed
  - Need to end call immediately
  - Staff unavailable

**🔄 Recall Button**
- **Function**: Ends current call and starts a new one
- **Action**:
  - Ends existing call
  - Waits 0.5 seconds
  - Initiates new call automatically
- **When to use**:
  - Connection issues
  - Need to reconnect
  - Call dropped unexpectedly

**📹 Open Video Window**
- **Function**: Opens video call interface in new window
- **Action**: Opens popup window (800x600px)
- **When to use**:
  - Video window closed accidentally
  - Need to reopen video interface

---

## 📊 Call Status Monitoring

### **Automatic Status Updates**
- System polls call status every **5 seconds**
- Updates call state automatically
- Detects when call ends
- Shows notifications for status changes

### **Status Indicators**

| Status | Indicator | Meaning |
|--------|-----------|---------|
| RINGING | Yellow pulsing dot | Waiting for answer |
| CONNECTED | Green dot | Call active |
| ENDED | Gray dot | Call completed |
| FAILED | Red dot | Call failed |

---

## 🔧 Advanced Features

### **Call Duration Tracking**
- Automatically tracks call duration
- Updates every second
- Displays in format: `M:SS`
- Resets when call ends

### **Availability Check**
- Checks staff availability every **30 seconds**
- Green dot indicator when staff available
- Button disabled when no staff available

### **Error Handling**
- Automatic retry on connection failures
- Clear error messages
- Graceful fallback if API fails

---

## 🎯 Best Practices

### **When to Use Video Assist**
✅ **Good Use Cases:**
- Complex prescription questions
- Drug interaction concerns
- Inventory management help
- Billing/GST questions
- Technical support

❌ **Avoid Using For:**
- Simple product lookups
- Basic price checks
- Routine operations

### **Call Management Tips**
1. **Wait for Connection**: Allow 10-15 seconds for call to connect
2. **Use Recall**: If call drops, use Recall button instead of starting new call
3. **Check Duration**: Monitor call duration for billing/tracking
4. **End Properly**: Always use Hang Up button to end calls cleanly

---

## 🚨 Troubleshooting

### **Call Won't Start**
- **Check**: Are you logged in as Pharmacist or Owner?
- **Check**: Is staff available? (Green dot indicator)
- **Solution**: Refresh page and try again

### **Call Stuck on "Ringing"**
- **Wait**: Give it 30 seconds
- **Action**: Use Recall button to reconnect
- **Check**: Browser console for errors

### **Can't End Call**
- **Action**: Click "Call Active" button to open controls
- **Action**: Click "Hang Up" button
- **Fallback**: Refresh page if button doesn't work

### **Video Window Won't Open**
- **Check**: Popup blocker settings
- **Action**: Click "Open Video Window" link in control panel
- **Check**: Browser permissions for popups

---

## 📱 Keyboard Shortcuts

Currently, Video Assist uses mouse clicks. Future enhancements may include:
- `Ctrl+Shift+V`: Quick initiate call
- `Esc`: End call
- `Ctrl+R`: Recall call

---

## 🔐 Security & Access

### **Who Can Use**
- ✅ **Pharmacist** accounts
- ✅ **Owner** accounts
- ❌ **Staff/Cashier** accounts (button hidden)
- ❌ **Guest** users (button hidden)

### **Call Logging**
- All calls are logged in database
- Includes: duration, participants, context
- Accessible via call history API

---

## 📈 Call Statistics

### **Tracked Metrics**
- Call duration
- Call status
- Participants
- Context (POS, Inventory, etc.)
- Timestamp

### **View History**
- Access via `/api/video-assist/calls/history`
- Shows last 50 calls by default
- Includes all call details

---

## 🎨 UI Elements

### **Button States**

| State | Color | Text | Meaning |
|-------|-------|------|---------|
| Available | Blue | "Video Assist" | Ready to call |
| Unavailable | Gray-Blue | "Video Assist" | No staff available |
| Calling | Gray | "Call Active" | Call in progress |
| Connected | Red | "Call Active" | Call connected |

### **Indicators**
- **Green dot** (top-right): Staff available
- **Status text** (below button): Current call status
- **Duration** (in controls): Call time elapsed

---

## ✅ Quick Reference

**Start Call**: Click "Video Assist" button  
**View Controls**: Click "Call Active" button  
**End Call**: Click "Hang Up" in control panel  
**Reconnect**: Click "Recall" button  
**Open Video**: Click "Open Video Window" link  

---

## 🔄 Updates & Improvements

### **Recent Enhancements**
- ✅ Call status polling (auto-updates every 5s)
- ✅ Call duration tracking
- ✅ Control panel with all actions
- ✅ Recall/reconnect functionality
- ✅ Participant status display
- ✅ Automatic call end detection

### **Future Enhancements**
- Mute/unmute controls
- Screen sharing toggle
- Call quality indicators
- Call recording option
- In-call chat

---

**Video Assist is now fully functional with complete call control and regulation!** 🎉
