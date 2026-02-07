# API Reference Guide - All 10 Features

**Date:** January 2026  
**Quick reference for all newly implemented APIs**

---

## 📋 **TABLE OF CONTENTS**

1. [TCS (Tax Collected at Source)](#1-tcs-tax-collected-at-source)
2. [Cash Memo](#2-cash-memo)
3. [Daily Reports](#3-daily-reports)
4. [SMS Notifications](#4-sms-notifications)
5. [Subscription Medicine](#5-subscription-medicine)
6. [GSTR-1 Export](#6-gstr-1-export)
7. [Home Delivery](#7-home-delivery)
8. [Referral Program](#8-referral-program)
9. [Health Reminders](#9-health-reminders)
10. [Telemedicine](#10-telemedicine)

---

## 1. TCS (Tax Collected at Source)

### Generate TCS Certificate
```http
POST /api/tcs/certificate
Content-Type: application/json

{
  "customerId": 123,
  "financialYear": "2024-25",
  "quarter": "Q1"
}
```

**Response:**
```json
{
  "success": true,
  "certificate": {
    "certificateNumber": "TCS/2024-25/0001",
    "totalSalesPaise": 10000000,
    "tcsAmountPaise": 100000,
    "tcsRate": 1.0
  }
}
```

---

## 2. Cash Memo

### Generate Cash Memo
```http
POST /api/invoices/cash-memo
Content-Type: application/json

{
  "customerId": 123,
  "lineItems": [
    {
      "productName": "Paracetamol 500mg",
      "quantity": 1,
      "unitPricePaise": 5000
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "cashMemo": {
    "cashMemoNumber": "CM/2024-01/0001",
    "totalPaise": 5000
  }
}
```

---

## 3. Daily Reports

### Daily Summary
```http
GET /api/reports/daily-summary?date=2024-01-15
```

### Expiry Alerts
```http
GET /api/reports/expiry-alerts?days=90
```

### Customer Analytics
```http
GET /api/reports/customer-analytics?from=2024-01-01&to=2024-01-31
```

### Profit Margin
```http
GET /api/reports/profit-margin?from=2024-01-01&to=2024-01-31
```

---

## 4. SMS Notifications

### Send Custom SMS
```http
POST /api/sms/send
Content-Type: application/json

{
  "to": "+919876543210",
  "message": "Your order has been confirmed"
}
```

### Send Pre-built Notification
```http
POST /api/sms/notifications
Content-Type: application/json

{
  "type": "ORDER_CONFIRMATION",
  "data": {
    "customerId": 123,
    "invoiceId": 456
  }
}
```

**Notification Types:**
- `ORDER_CONFIRMATION`
- `PRESCRIPTION_REFILL_REMINDER`
- `STOCK_ARRIVAL_ALERT`
- `PAYMENT_REMINDER`
- `BIRTHDAY_OFFER`
- `DELIVERY_UPDATE`

---

## 5. Subscription Medicine

### List Subscriptions
```http
GET /api/subscriptions/medicine?customerId=123&status=ACTIVE
```

### Create Subscription
```http
POST /api/subscriptions/medicine
Content-Type: application/json

{
  "customerId": 123,
  "frequency": "MONTHLY",
  "startDate": "2024-01-15",
  "items": [
    {
      "drugLibraryId": 1,
      "quantity": 30,
      "dosage": "1-0-1"
    }
  ],
  "deliveryAddress": "123 Main St"
}
```

### Get Subscription
```http
GET /api/subscriptions/medicine/123
```

### Update Subscription
```http
PUT /api/subscriptions/medicine/123
Content-Type: application/json

{
  "status": "PAUSED"
}
```

### Cancel Subscription
```http
DELETE /api/subscriptions/medicine/123
```

---

## 6. GSTR-1 Export

### Export GSTR-1 CSV
```http
GET /api/reports/gstr1?from=2024-01-01&to=2024-01-31
```

**Response:** CSV file download

**CSV Tables:**
- B2B (invoices with GSTIN)
- B2C_Large (invoices without GSTIN, >= ₹2.5L)
- B2C_Small (summary by GST rate)
- HSN_Summary
- Credit_Note

---

## 7. Home Delivery

### List Deliveries
```http
GET /api/deliveries?status=PENDING&customerId=123
```

### Create Delivery
```http
POST /api/deliveries
Content-Type: application/json

{
  "invoiceId": 456,
  "deliveryAddressId": 789,
  "scheduledDate": "2024-01-20",
  "deliveryFeePaise": 5000,
  "distance": 5.5
}
```

### Track Delivery
```http
GET /api/deliveries/123/track
```

### Confirm Delivery (OTP)
```http
POST /api/deliveries/123/confirm
Content-Type: application/json

{
  "otp": "123456"
}
```

---

## 8. Referral Program

### Get Referral Code
```http
GET /api/referrals/code?customerId=123
```

### Generate Referral Code
```http
POST /api/referrals/code
Content-Type: application/json

{
  "customerId": 123
}
```

**Response:**
```json
{
  "success": true,
  "referralCode": "REF-ABC123"
}
```

### Process Referral
```http
POST /api/referrals/process
Content-Type: application/json

{
  "referralCode": "REF-ABC123",
  "customerId": 456
}
```

### Get Referral Analytics
```http
GET /api/referrals/analytics?customerId=123
```

**Response:**
```json
{
  "success": true,
  "analytics": {
    "totalReferrals": 10,
    "confirmedReferrals": 8,
    "pendingReferrals": 2,
    "totalRewardsPaise": 0
  }
}
```

---

## 9. Health Reminders

### Get Upcoming Reminders
```http
GET /api/health/reminders?customerId=123&days=7
```

### Create Medicine Intake Reminder
```http
POST /api/health/reminders
Content-Type: application/json

{
  "type": "medicine_intake",
  "customerId": 123,
  "prescriptionId": 456,
  "medicineName": "Paracetamol",
  "dosage": "1-0-1",
  "startDate": "2024-01-15",
  "durationDays": 30
}
```

### Create Prescription Refill Reminder
```http
POST /api/health/reminders
Content-Type: application/json

{
  "type": "prescription_refill",
  "customerId": 123,
  "prescriptionId": 456,
  "daysBeforeRefill": 7
}
```

### Create Custom Reminder
```http
POST /api/health/reminders
Content-Type: application/json

{
  "type": "custom",
  "customerId": 123,
  "reminderType": "HEALTH_CHECKUP",
  "title": "Annual Health Checkup",
  "scheduledDate": "2024-06-15",
  "frequency": "YEARLY"
}
```

---

## 10. Telemedicine

### List Consultations
```http
GET /api/telemedicine/consultations?customerId=123&status=SCHEDULED
```

### Book Consultation
```http
POST /api/telemedicine/consultations
Content-Type: application/json

{
  "customerId": 123,
  "doctorId": 456,
  "appointmentDate": "2024-01-20T10:00:00Z",
  "symptoms": "Fever and cough"
}
```

**Response:**
```json
{
  "success": true,
  "consultation": {
    "id": 789,
    "meetingUrl": "https://zoom.us/j/123456789",
    "appointmentDate": "2024-01-20T10:00:00Z"
  }
}
```

### Complete Consultation
```http
POST /api/telemedicine/consultations/789/complete
Content-Type: application/json

{
  "diagnosis": "Common cold",
  "prescriptionLines": [
    {
      "medicationName": "Paracetamol 500mg",
      "dosage": "1 tablet",
      "frequency": "3 times daily",
      "duration": "5 days",
      "quantity": 15
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "prescriptionId": 999,
  "message": "Consultation completed and e-prescription generated"
}
```

---

## 🔐 **AUTHENTICATION**

All APIs require authentication. Include session cookie or Bearer token:

```http
Authorization: Bearer <token>
```

Or use session-based authentication (cookies).

---

## 📝 **COMMON RESPONSE FORMAT**

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "error": "Error message",
  "success": false
}
```

---

## 🚀 **QUICK START**

1. **Authenticate** - Login to get session
2. **Call API** - Use appropriate endpoint
3. **Handle Response** - Check `success` field
4. **Error Handling** - Check `error` field on failure

---

**Last Updated:** January 2026
