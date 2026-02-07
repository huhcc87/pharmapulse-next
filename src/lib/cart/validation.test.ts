/**
 * Unit tests for cart validation
 * Run with: npm test or tsx src/lib/cart/validation.test.ts
 */

import { validateCartForInvoice, normalizeLineItem, filterBlockingIssues } from "./validation";

// Test 1: Valid taxable item
function testValidTaxableItem() {
  console.log("Test 1: Valid taxable item");
  const validItem = {
    productId: 1,
    productName: "Paracetamol 500mg",
    quantity: 2,
    unitPricePaise: 5000, // ₹50.00
    gstRate: 12,
    hsnCode: "3004",
    gstType: "EXCLUSIVE",
  };

  const issues = validateCartForInvoice([validItem]);
  const blocking = filterBlockingIssues(issues);

  if (blocking.length === 0) {
    console.log("✅ PASS: Valid item has no blocking issues");
  } else {
    console.log("❌ FAIL: Valid item has issues:", blocking);
  }

  const normalized = normalizeLineItem(validItem);
  if (normalized && normalized.gstRate === 12 && normalized.productName === "Paracetamol 500mg") {
    console.log("✅ PASS: Normalization works correctly");
  } else {
    console.log("❌ FAIL: Normalization failed", normalized);
  }
  console.log("");
}

// Test 2: Missing gstRate
function testMissingGstRate() {
  console.log("Test 2: Missing gstRate");
  const itemWithoutGst = {
    productId: 2,
    productName: "Aspirin 100mg",
    quantity: 1,
    unitPricePaise: 3000,
    // gstRate is missing
    hsnCode: "3004",
  };

  const issues = validateCartForInvoice([itemWithoutGst]);
  const blocking = filterBlockingIssues(issues);

  const hasMissingGst = blocking.some(i => i.type === "MISSING_GST");
  if (hasMissingGst) {
    console.log("✅ PASS: Missing GST detected");
    console.log("   Issue:", blocking.find(i => i.type === "MISSING_GST")?.message);
  } else {
    console.log("❌ FAIL: Missing GST not detected");
  }

  const normalized = normalizeLineItem(itemWithoutGst);
  if (normalized && normalized.gstRate === 12) {
    console.log("✅ PASS: Normalization provides default GST rate");
  } else {
    console.log("❌ FAIL: Normalization didn't provide default", normalized);
  }
  console.log("");
}

// Test 3: Missing tax_profile join
function testMissingTaxProfile() {
  console.log("Test 3: Missing tax_profile join");
  const itemWithTaxProfile = {
    productId: 3,
    productName: "Ibuprofen 400mg",
    quantity: 1,
    unitPricePaise: 4000,
    tax_profile: {
      gst_rate: 18,
      gst_type: "EXCLUSIVE",
    },
  };

  const issues = validateCartForInvoice([itemWithTaxProfile]);
  const blocking = filterBlockingIssues(issues);

  if (blocking.length === 0) {
    console.log("✅ PASS: Item with tax_profile has no blocking issues");
  } else {
    console.log("❌ FAIL: Item with tax_profile has issues:", blocking);
  }

  const normalized = normalizeLineItem(itemWithTaxProfile);
  if (normalized && normalized.gstRate === 18) {
    console.log("✅ PASS: Normalization correctly reads from tax_profile");
  } else {
    console.log("❌ FAIL: Normalization didn't read tax_profile", normalized);
  }

  // Test missing tax_profile
  const itemWithoutTaxProfile = {
    productId: 4,
    productName: "Cough Syrup",
    quantity: 1,
    unitPricePaise: 2000,
    // tax_profile is missing
  };

  const issues2 = validateCartForInvoice([itemWithoutTaxProfile]);
  const blocking2 = filterBlockingIssues(issues2);
  const hasMissingGst2 = blocking2.some(i => i.type === "MISSING_GST");

  if (hasMissingGst2) {
    console.log("✅ PASS: Missing tax_profile detected as missing GST");
  } else {
    console.log("❌ FAIL: Missing tax_profile not detected");
  }
  console.log("");
}

// Run all tests
if (require.main === module) {
  console.log("Running cart validation tests...\n");
  testValidTaxableItem();
  testMissingGstRate();
  testMissingTaxProfile();
  console.log("All tests completed!");
}

export { testValidTaxableItem, testMissingGstRate, testMissingTaxProfile };
