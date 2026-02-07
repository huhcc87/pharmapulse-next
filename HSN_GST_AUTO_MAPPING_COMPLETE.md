# ✅ HSN → GST Auto-Mapping & GST Audit-Compliant Wording - Complete

## Summary

Enhanced **Add New Product** modal with:
1. **HSN → GST Auto-Mapping** - Automatically sets GST Rate/Type when HSN code is entered
2. **GST Audit-Compliant Wording** - India GST audit-ready help text and validation
3. **Audit Logging** - Tracks mapping source and HSN prefix used

## Features Implemented

### 1. **HSN → GST Auto-Mapping Engine**

#### Mapping Configuration (`/lib/gst/hsnGstMapping.ts`)
- ✅ **Longest-prefix matching** (8-digit > 6-digit > 4-digit > 2-digit)
- ✅ **Starter mapping database** for common pharmacy items:
  - `3004` → GST 12% (Medicaments in measured doses)
  - `3003` → GST 12% (Medicaments not in measured doses)
  - `3002` → GST 5% (Blood, antisera, vaccines - varies, verify)
  - `9018` → GST 12% (Medical instruments - varies, verify)
  - `3306` → GST 18% (Oral/dental hygiene - varies, verify)
  - `3401` → GST 18% (Soaps/cleansers - varies, verify)
  - `2202` → GST 12% (Non-alcoholic beverages - varies, verify)
  - `2106` → GST 18% (Nutritional supplements - varies, verify)
  - And more...

#### Auto-Mapping Logic
- ✅ **Sanitizes HSN** (digits only)
- ✅ **Matches longest prefix** automatically
- ✅ **Auto-sets GST Rate** when match found
- ✅ **Auto-sets GST Type** to EXCLUSIVE (default)
- ✅ **Suggests Category** if empty/General
- ✅ **Shows mapping badge**: "GST Auto-mapped" (green badge)
- ✅ **Shows mapping note**: "Verify with invoice/HSN classification"

#### Manual Override Protection
- ✅ **Tracks manual changes** - If user edits GST Rate/Type after auto-mapping
- ✅ **"Manual Override" badge** appears when GST manually changed
- ✅ **"Reapply HSN Mapping" button** - Re-apply mapping after manual override
- ✅ **No auto-change after manual override** - Respects user changes

### 2. **GST Audit-Compliant Wording**

#### B1) Near HSN + GST Fields (Blue Notice Banner)
✅ **"GST Compliance" notice**:
```
"HSN and GST values should match the supplier tax invoice. This app auto-suggests GST based on HSN mapping; pharmacist/owner must verify before saving."
```

#### B2) Under GST Rate Field (Helper Text)
✅ **GST Rate helper**:
```
"GST Rate is used for invoice tax calculation (CGST/SGST or IGST as applicable). Confirm rate and HSN from purchase invoice to avoid GST return mismatches."
```

#### B3) Under GST Type Field (Helper Text)
✅ **GST Type helper**:
```
"EXCLUSIVE: GST added on top of unit price. INCLUSIVE: GST included in unit price. Choose the same method used in your billing practice."
```

#### B4) In AI Product Lookup Panel (Yellow Banner)
✅ **AI Lookup banner**:
```
"AI-suggested details are assistive only. Verify product name, HSN, schedule, and MRP from the physical pack label and supplier invoice before saving."
```

#### B5) Save Confirmation (Audit Trace)
✅ **Audit confirmation message**:
```
"Saved with audit trace: HSN (30049099), GST Rate (12%), GST Type (EXCLUSIVE), verified-by user, and timestamp."
```

### 3. **HSN Code Validation**

#### Helper Text
- ✅ **"4–8 digits recommended for GST invoices (e.g., 3004 / 30049099)."**
- ✅ **Warnings**:
  - 2-digit only: "Use 4-8 digits for GST invoices. 2-digit codes are for internal use only."
  - Invalid length: Shows appropriate warnings

#### Validation Rules
- ✅ **Allows 2–8 digits** (2-digit for internal use with warning)
- ✅ **Sanitizes input** (digits only)
- ✅ **Max length: 8 digits**
- ✅ **Non-blocking warnings** (allows save but shows compliance warnings)

### 4. **UI Enhancements**

#### GST Auto-Mapped Badge
- ✅ **Green badge** with checkmark: "GST Auto-mapped"
- ✅ **Shows when** HSN mapping applied successfully
- ✅ **Appears next to** HSN Code label

#### "Reapply HSN Mapping" Button
- ✅ **Button near GST Rate** field
- ✅ **Visible when** GST was auto-mapped
- ✅ **Re-applies** HSN → GST mapping if user overrode it

#### Manual Override Banner
- ✅ **Yellow banner** when GST manually overridden
- ✅ **Message**: "Manual Override: GST rate manually changed. Click 'Reapply HSN Mapping' to auto-map again."

#### Mapping Notes
- ✅ **Shows mapping notes** below GST Rate field
- ✅ **Example**: "Medicaments in measured doses - retail packs. Verify with invoice."

### 5. **Audit Metadata**

#### Stored on Save
- ✅ **`gstAutofillSource`**: `"HSN_MAPPING"` or `"MANUAL"`
- ✅ **`hsnPrefixUsed`**: HSN prefix that matched (e.g., "3004", "30049099")
- ✅ **All fields editable** - No auto-lock
- ✅ **Audit trace in save confirmation** - Shows HSN, GST Rate, GST Type, verified-by, timestamp

## How It Works

### Step 1: User Enters HSN Code
1. **Enter HSN Code**: `30049099` (or `3004`, etc.)
2. **System sanitizes**: Removes non-digits
3. **System searches**: Longest-prefix match in mapping database
4. **Match found**: `30049099` → `3004` mapping (12% GST)

### Step 2: Auto-Mapping Applied
1. **GST Rate auto-set**: `12%`
2. **GST Type auto-set**: `EXCLUSIVE`
3. **Badge appears**: "GST Auto-mapped" (green)
4. **Mapping note shown**: "Verify with invoice/HSN classification"

### Step 3: User Verifies/Overrides
1. **User reviews** auto-mapped values
2. **Options**:
   - **Accept**: Save as-is (mapping applied)
   - **Override**: Change GST Rate/Type manually (badge changes to "Manual Override")
   - **Reapply**: Click "Reapply HSN Mapping" to re-apply mapping

### Step 4: Save with Audit Trace
1. **Click "Add Product"**
2. **System saves** with audit metadata:
   - `gstAutofillSource`: "HSN_MAPPING" or "MANUAL"
   - `hsnPrefixUsed`: "3004" or null
3. **Confirmation shows**: "Saved with audit trace: HSN, GST Rate, GST Type, verified-by, timestamp"

## Example Usage

### Example 1: Auto-Mapping HSN → GST
1. **Enter HSN Code**: `30049099`
2. **Auto-mapped**:
   - GST Rate: `12%` ✅
   - GST Type: `EXCLUSIVE` ✅
   - Badge: "GST Auto-mapped" ✅
   - Note: "Verify with invoice/HSN classification" ✅
3. **Save** → Audit trace: `gstAutofillSource: "HSN_MAPPING"`, `hsnPrefixUsed: "3004"`

### Example 2: Manual Override
1. **Enter HSN Code**: `30049099`
2. **Auto-mapped**: GST Rate `12%`
3. **User changes**: GST Rate to `18%`
4. **Badge changes**: "Manual Override" (yellow)
5. **User can**: Click "Reapply HSN Mapping" to revert to `12%`
6. **Save** → Audit trace: `gstAutofillSource: "MANUAL"`

### Example 3: No Mapping Found
1. **Enter HSN Code**: `9999` (not in mapping)
2. **No auto-mapping**:
   - GST Rate: `12%` (default, unchanged)
   - Message: "HSN not mapped. Please select GST rate manually."
3. **User selects** GST Rate manually
4. **Save** → Audit trace: `gstAutofillSource: "MANUAL"`

## Validation Warnings (Non-Blocking)

- ✅ **HSN missing but GST set**: Warns but allows save
- ✅ **HSN set but GST not set**: Warns but allows save
- ✅ **2-digit HSN**: Warns "Use 4-8 digits for GST invoices"
- ✅ **All warnings are informational** - Do not block product creation

## Files Modified

1. **`src/lib/gst/hsnGstMapping.ts`** (NEW)
   - HSN → GST mapping configuration
   - Longest-prefix matching logic
   - HSN validation helpers

2. **`src/components/AddProductModal.tsx`** (ENHANCED)
   - HSN → GST auto-mapping on HSN change
   - "GST Auto-mapped" badge
   - "Reapply HSN Mapping" button
   - Manual override tracking
   - Audit-compliant wording throughout
   - Audit metadata in save request

## Success Criteria ✅

1. ✅ Enter HSN `30049099` → GST rate auto-sets to 12%, badge shows "GST Auto-mapped"
2. ✅ User manually changes GST rate → Badge changes to "Manual Override", no more auto-changes
3. ✅ User clicks "Reapply HSN Mapping" → GST rate reverts to mapped value, badge shows "GST Auto-mapped" again
4. ✅ Save product → Audit metadata stored: `gstAutofillSource`, `hsnPrefixUsed`
5. ✅ All GST audit-compliant wording appears in modal
6. ✅ All fields remain editable with audit trails

---

**HSN → GST Auto-Mapping and GST Audit-Compliant Wording are now live in the Add New Product modal! 🎉**
