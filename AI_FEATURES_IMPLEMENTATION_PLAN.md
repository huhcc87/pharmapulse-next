# 2026 AI-Driven Features Implementation Plan

## Current State Assessment

### ✅ Already Implemented:
1. **Audit Logs**: `PosAuditLog` model and utility (`src/lib/pos-audit.ts`)
2. **HSN/GST Infrastructure**: `HSNMaster`, `HsnRule` models, auto-mapping utility
3. **Prescription Models**: `Prescription`, `PrescriptionLine` models exist
4. **DemandForecast Model**: Schema exists but no implementation
5. **Basic AI API**: `/api/ai/route.ts` with OpenAI integration

### ❌ Needs Implementation:
1. **Offline POS**: Only stub exists - needs full implementation
2. **Counter Copilot**: No interaction checking exists
3. **Rx OCR**: No OCR pipeline exists
4. **Demand Forecasting**: UI exists but uses mock data, needs real algorithm
5. **HSN AI Suggestions**: Auto-mapping exists but needs AI suggestion layer

## Implementation Order

1. Prisma schema updates (offline tokens, sync audit, drug interactions)
2. Offline POS system (tokens, IndexedDB, sync)
3. Counter Copilot (interactions + counseling)
4. Rx OCR pipeline
5. Real demand forecasting
6. Enhanced HSN assistant with AI
