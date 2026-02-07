// Lab Test Booking Integration
// Integration with lab test providers (1mg, Healthians, etc.)

export interface LabTestProvider {
  id: string;
  name: string;
  apiEndpoint: string;
  commissionRate: number; // percentage
}

export interface LabTest {
  id: string;
  name: string;
  category: string;
  price: number; // in paise
  provider: string;
  description?: string;
  fastingRequired?: boolean;
  sampleType?: string;
}

export interface LabBooking {
  bookingId: string;
  customerId: number;
  customerName: string;
  customerPhone: string;
  tests: Array<{
    testId: string;
    testName: string;
    price: number;
  }>;
  totalAmount: number; // in paise
  commission: number; // in paise
  bookingDate: Date;
  sampleCollectionDate?: Date;
  status: 'BOOKED' | 'SAMPLE_COLLECTED' | 'COMPLETED' | 'CANCELLED';
  provider: string;
  providerBookingId?: string;
}

/**
 * Get available lab tests
 */
export async function getAvailableLabTests(
  provider?: string
): Promise<LabTest[]> {
  // Mock implementation
  // Would integrate with actual lab test provider APIs
  return [
    {
      id: 'test-1',
      name: 'Complete Blood Count (CBC)',
      category: 'Blood Test',
      price: 50000, // ₹500
      provider: '1mg',
      fastingRequired: false,
      sampleType: 'Blood',
    },
    {
      id: 'test-2',
      name: 'Blood Sugar (Fasting)',
      category: 'Blood Test',
      price: 15000, // ₹150
      provider: '1mg',
      fastingRequired: true,
      sampleType: 'Blood',
    },
  ];
}

/**
 * Book lab test
 */
export async function bookLabTest(
  customerId: number,
  customerName: string,
  customerPhone: string,
  testIds: string[],
  provider: string = '1mg'
): Promise<LabBooking> {
  // Get test details
  const tests = await getAvailableLabTests(provider);
  const selectedTests = tests.filter((t) => testIds.includes(t.id));

  const totalAmount = selectedTests.reduce(
    (sum, test) => sum + test.price,
    0
  );

  // Calculate commission (e.g., 10%)
  const commissionRate = 0.1;
  const commission = Math.round(totalAmount * commissionRate);

  const bookingId = `LAB/${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

  // Would call provider API to book
  // const providerResponse = await callProviderAPI(...);

  return {
    bookingId,
    customerId,
    customerName,
    customerPhone,
    tests: selectedTests.map((t) => ({
      testId: t.id,
      testName: t.name,
      price: t.price,
    })),
    totalAmount,
    commission,
    bookingDate: new Date(),
    status: 'BOOKED',
    provider,
    // providerBookingId: providerResponse.bookingId,
  };
}
