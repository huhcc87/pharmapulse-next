# UI Integration Guide - PharmaPulse

## 📋 **TABLE OF CONTENTS**

1. [Overview](#overview)
2. [UI Component Patterns](#ui-component-patterns)
3. [API Integration Patterns](#api-integration-patterns)
4. [Feature-Specific Integration](#feature-specific-integration)
5. [Component Examples](#component-examples)
6. [Best Practices](#best-practices)
7. [Common Patterns](#common-patterns)

---

## 📖 **OVERVIEW**

This guide helps you integrate UI components with the existing 201+ API endpoints. All backend APIs are ready; you need to build React components to consume them.

### **Existing UI Libraries:**
- **shadcn/ui** - Component library (already installed)
- **Radix UI** - Headless UI primitives
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **zustand** - State management (optional)

### **File Structure:**
```
src/
├── app/                    # Next.js pages
├── components/             # React components
│   ├── ui/                # shadcn/ui components
│   ├── dashboard/         # Dashboard components
│   ├── pos/               # POS components
│   └── ...
├── lib/                    # Utilities and business logic
└── hooks/                  # Custom React hooks (create as needed)
```

---

## 🎨 **UI COMPONENT PATTERNS**

### **1. Basic API Integration Pattern**

```typescript
'use client'

import { useEffect, useState } from 'react'

export default function FeatureComponent() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const response = await fetch('/api/feature-endpoint')
        
        if (!response.ok) {
          throw new Error('Failed to fetch data')
        }
        
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!data) return <div>No data</div>

  return (
    <div>
      {/* Render your UI here */}
    </div>
  )
}
```

### **2. Custom Hook Pattern**

Create `src/hooks/useFeatureData.ts`:

```typescript
import { useState, useEffect } from 'react'

export function useFeatureData() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const response = await fetch('/api/feature-endpoint')
        
        if (!response.ok) {
          throw new Error('Failed to fetch data')
        }
        
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading, error, refetch: () => fetchData() }
}
```

Then use in component:

```typescript
import { useFeatureData } from '@/hooks/useFeatureData'

export default function FeatureComponent() {
  const { data, loading, error } = useFeatureData()

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return <div>{/* Render UI */}</div>
}
```

### **3. Form Submission Pattern**

```typescript
'use client'

import { useState } from 'react'

export default function CreateForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const data = Object.fromEntries(formData)

    try {
      const response = await fetch('/api/feature-endpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to submit')
      }

      const result = await response.json()
      // Handle success (redirect, show toast, etc.)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      {error && <div className="text-red-500">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  )
}
```

---

## 🔌 **API INTEGRATION PATTERNS**

### **1. GET Request with Query Parameters**

```typescript
async function fetchWithParams(params: Record<string, string>) {
  const queryString = new URLSearchParams(params).toString()
  const response = await fetch(`/api/endpoint?${queryString}`)
  return response.json()
}

// Usage
const data = await fetchWithParams({ from: '2026-01-01', to: '2026-01-31' })
```

### **2. POST Request with Body**

```typescript
async function postData(data: any) {
  const response = await fetch('/api/endpoint', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  
  if (!response.ok) {
    throw new Error('Request failed')
  }
  
  return response.json()
}
```

### **3. Authenticated Requests**

```typescript
async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Include cookies
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
    },
  })
  
  if (response.status === 401) {
    // Handle unauthorized - redirect to login
    window.location.href = '/login'
    return
  }
  
  return response
}
```

### **4. Error Handling**

```typescript
async function fetchWithErrorHandling(url: string) {
  try {
    const response = await fetch(url)
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: 'Unknown error',
        message: `HTTP ${response.status}`,
      }))
      
      throw new Error(error.message || error.error || 'Request failed')
    }
    
    return await response.json()
  } catch (err) {
    if (err instanceof TypeError) {
      // Network error
      throw new Error('Network error. Please check your connection.')
    }
    throw err
  }
}
```

---

## 🎯 **FEATURE-SPECIFIC INTEGRATION**

### **1. Supplier Management UI**

Create `src/app/suppliers/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Supplier {
  id: number
  name: string
  gstin?: string
  phone?: string
  email?: string
  performance?: {
    rating: number
    totalOrders: number
    onTimeDeliveryRate: number
  }
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSuppliers() {
      try {
        const response = await fetch('/api/purchase-orders')
        // Assuming this returns suppliers - adjust based on actual API
        const data = await response.json()
        setSuppliers(data.suppliers || [])
      } catch (err) {
        console.error('Failed to fetch suppliers:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSuppliers()
  }, [])

  async function handleViewPerformance(supplierId: number) {
    const response = await fetch(`/api/suppliers/performance/${supplierId}`)
    const data = await response.json()
    // Show performance data in modal or navigate to detail page
    console.log('Performance:', data)
  }

  if (loading) return <div>Loading suppliers...</div>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Suppliers</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map((supplier) => (
          <Card key={supplier.id}>
            <CardHeader>
              <CardTitle>{supplier.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>GSTIN: {supplier.gstin || 'N/A'}</p>
              <p>Phone: {supplier.phone || 'N/A'}</p>
              {supplier.performance && (
                <div className="mt-4">
                  <p>Rating: {supplier.performance.rating}/5</p>
                  <p>Orders: {supplier.performance.totalOrders}</p>
                  <p>On-time: {supplier.performance.onTimeDeliveryRate.toFixed(1)}%</p>
                </div>
              )}
              <Button
                onClick={() => handleViewPerformance(supplier.id)}
                className="mt-4"
              >
                View Performance
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

### **2. Advanced Analytics Dashboard**

Create `src/app/analytics/custom-reports/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function CustomReportsPage() {
  const [reportConfig, setReportConfig] = useState({
    name: 'Sales by Product',
    fields: [
      { id: 'product_name', name: 'Product', type: 'dimension' },
      { id: 'revenue', name: 'Revenue', type: 'metric', aggregation: 'sum' },
    ],
    filters: [],
    groupBy: ['product_name'],
    format: 'both',
    chartType: 'bar',
  })
  const [reportData, setReportData] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleBuildReport() {
    setLoading(true)
    try {
      const response = await fetch('/api/analytics/reports/build', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config: reportConfig }),
      })

      if (!response.ok) {
        throw new Error('Failed to build report')
      }

      const data = await response.json()
      setReportData(data.report)
    } catch (err) {
      console.error('Failed to build report:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Custom Reports</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Report Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Report builder UI here */}
          <Button onClick={handleBuildReport} disabled={loading}>
            {loading ? 'Building...' : 'Build Report'}
          </Button>
        </CardContent>
      </Card>

      {reportData && (
        <Card>
          <CardHeader>
            <CardTitle>Report Results</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Render report data - table, charts, etc. */}
            <pre>{JSON.stringify(reportData, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

### **3. TCS (Tax Collected at Source) UI**

Create `src/app/billing/tcs/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TCSPage() {
  const [tcsData, setTcsData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch TCS data - implement API endpoint
    // For now, using mock structure
    setTcsData([])
    setLoading(false)
  }, [])

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount / 100)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">TCS (Tax Collected at Source)</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>TCS Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div>Loading...</div>
          ) : tcsData.length === 0 ? (
            <div>No TCS data found</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Amount</th>
                  <th>TCS (0.1%)</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {tcsData.map((item) => (
                  <tr key={item.id}>
                    <td>{item.invoiceNumber}</td>
                    <td>{formatCurrency(item.invoiceAmount)}</td>
                    <td>{formatCurrency(item.tcsAmount)}</td>
                    <td>{new Date(item.date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

### **4. Cash Memo UI**

Create `src/app/pos/cash-memo/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function CashMemoPage() {
  const [items, setItems] = useState([
    { productName: '', quantity: 1, unitPrice: 0, total: 0 },
  ])
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD'>('CASH')
  const [customerName, setCustomerName] = useState('')

  function addItem() {
    setItems([...items, { productName: '', quantity: 1, unitPrice: 0, total: 0 }])
  }

  function updateItem(index: number, field: string, value: any) {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    if (field === 'quantity' || field === 'unitPrice') {
      updated[index].total = updated[index].quantity * updated[index].unitPrice
    }
    setItems(updated)
  }

  const totalAmount = items.reduce((sum, item) => sum + item.total, 0)

  async function handleSubmit() {
    const cashMemo = {
      items: items.map(item => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      totalAmount,
      paymentMethod,
      customerName: customerName || undefined,
    }

    // Implement API call to create cash memo
    // await fetch('/api/cash-memo', { method: 'POST', body: JSON.stringify(cashMemo) })
    
    console.log('Cash Memo:', cashMemo)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Cash Memo (Quick Sale)</h1>
      
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="flex gap-4">
            <Input
              placeholder="Product Name"
              value={item.productName}
              onChange={(e) => updateItem(index, 'productName', e.target.value)}
            />
            <Input
              type="number"
              placeholder="Qty"
              value={item.quantity}
              onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
              className="w-20"
            />
            <Input
              type="number"
              placeholder="Price"
              value={item.unitPrice}
              onChange={(e) => updateItem(index, 'unitPrice', parseInt(e.target.value))}
              className="w-32"
            />
            <div className="flex items-center w-24">
              ₹{item.total / 100}
            </div>
          </div>
        ))}
        
        <Button onClick={addItem} variant="outline">Add Item</Button>
        
        <div className="mt-4">
          <Input
            placeholder="Customer Name (Optional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>
        
        <div className="mt-4">
          <label>Payment Method:</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as any)}
            className="ml-2 p-2 border rounded"
          >
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
          </select>
        </div>
        
        <div className="mt-4 text-xl font-bold">
          Total: ₹{totalAmount / 100}
        </div>
        
        <Button onClick={handleSubmit} className="w-full mt-4">
          Generate Cash Memo
        </Button>
      </div>
    </div>
  )
}
```

### **5. Lab Test Booking UI**

Create `src/app/services/lab-tests/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface LabTest {
  id: string
  name: string
  category: string
  price: number
  provider: string
}

export default function LabTestsPage() {
  const [tests, setTests] = useState<LabTest[]>([])
  const [selectedTests, setSelectedTests] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTests() {
      // Implement API call when endpoint is ready
      // const response = await fetch('/api/lab-tests')
      // const data = await response.json()
      // setTests(data.tests)
      setLoading(false)
    }

    fetchTests()
  }, [])

  function toggleTest(testId: string) {
    setSelectedTests((prev) =>
      prev.includes(testId)
        ? prev.filter((id) => id !== testId)
        : [...prev, testId]
    )
  }

  async function handleBookTests(customerId: number, customerName: string, customerPhone: string) {
    // Implement booking API call
    // const response = await fetch('/api/lab-tests/book', {
    //   method: 'POST',
    //   body: JSON.stringify({ customerId, customerName, customerPhone, testIds: selectedTests })
    // })
  }

  const totalPrice = tests
    .filter((t) => selectedTests.includes(t.id))
    .reduce((sum, t) => sum + t.price, 0)

  if (loading) return <div>Loading lab tests...</div>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Book Lab Tests</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tests.map((test) => (
          <Card
            key={test.id}
            className={selectedTests.includes(test.id) ? 'border-blue-500' : ''}
          >
            <CardHeader>
              <CardTitle>{test.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{test.category}</p>
              <p className="text-lg font-bold mt-2">₹{test.price / 100}</p>
              <Button
                onClick={() => toggleTest(test.id)}
                variant={selectedTests.includes(test.id) ? 'default' : 'outline'}
                className="mt-4"
              >
                {selectedTests.includes(test.id) ? 'Selected' : 'Select'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {selectedTests.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Selected Tests ({selectedTests.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">Total: ₹{totalPrice / 100}</p>
            <Button onClick={() => handleBookTests(1, 'Customer', '+919876543210')} className="mt-4">
              Book Tests
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

---

## 💡 **BEST PRACTICES**

### **1. Loading States**

Always show loading indicators:

```typescript
{loading ? (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
  </div>
) : (
  // Content
)}
```

### **2. Error Handling**

Show user-friendly error messages:

```typescript
{error && (
  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
    {error}
  </div>
)}
```

### **3. Empty States**

Show helpful empty states:

```typescript
{data.length === 0 ? (
  <div className="text-center py-12 text-gray-500">
    No data found. <Button onClick={handleRefresh}>Refresh</Button>
  </div>
) : (
  // Content
)}
```

### **4. Type Safety**

Always use TypeScript types:

```typescript
interface APIResponse {
  success: boolean
  data: YourDataType
  error?: string
}

const response: APIResponse = await fetch('/api/endpoint').then(r => r.json())
```

### **5. Responsive Design**

Use Tailwind responsive classes:

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Content */}
</div>
```

---

## 🔄 **COMMON PATTERNS**

### **1. Data Table Pattern**

```typescript
import { useState } from 'react'

export default function DataTable({ data }: { data: any[] }) {
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedData = [...data].sort((a, b) => {
    if (!sortColumn) return 0
    const aVal = a[sortColumn]
    const bVal = b[sortColumn]
    return sortDirection === 'asc'
      ? aVal > bVal ? 1 : -1
      : aVal < bVal ? 1 : -1
  })

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th onClick={() => handleSort('name')}>Name</th>
          <th onClick={() => handleSort('date')}>Date</th>
          {/* More columns */}
        </tr>
      </thead>
      <tbody>
        {sortedData.map((row) => (
          <tr key={row.id}>
            <td>{row.name}</td>
            <td>{row.date}</td>
            {/* More cells */}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

### **2. Modal Pattern**

```typescript
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export default function ModalExample() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setOpen(true)}>Open Modal</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modal Title</DialogTitle>
          </DialogHeader>
          {/* Modal content */}
        </DialogContent>
      </Dialog>
    </>
  )
}
```

### **3. Toast Notifications**

```typescript
// Install react-hot-toast or use shadcn/ui toast
import toast from 'react-hot-toast'

async function handleAction() {
  try {
    await fetch('/api/endpoint')
    toast.success('Action completed successfully')
  } catch (err) {
    toast.error('Action failed')
  }
}
```

---

## ✅ **INTEGRATION CHECKLIST**

### **For Each Feature:**
- [ ] Create page component (`src/app/[feature]/page.tsx`)
- [ ] Create API hook (`src/hooks/use[Feature]Data.ts`)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add empty states
- [ ] Add TypeScript types
- [ ] Test with real API endpoints
- [ ] Add responsive design
- [ ] Add accessibility (ARIA labels)
- [ ] Add documentation

---

## 📚 **RESOURCES**

- **shadcn/ui Components:** https://ui.shadcn.com/docs/components
- **Next.js Docs:** https://nextjs.org/docs
- **React Hooks:** https://react.dev/reference/react
- **TypeScript:** https://www.typescriptlang.org/docs
- **Tailwind CSS:** https://tailwindcss.com/docs

---

**Last Updated:** January 2026  
**Status:** ✅ Ready for UI Integration
