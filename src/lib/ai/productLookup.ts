// AI-driven product lookup service
// This integrates with product databases and AI to fetch product details
import { searchProductByBarcode } from './webProductSearch';

interface ProductDetails {
  name: string;
  category: string;
  description?: string;
  manufacturer?: string;
  composition?: string;
  dosage?: string;
  packSize?: string;
  mrp?: number;
  unitPrice?: number;
  hsnCode?: string;
  schedule?: string;
  storage?: string;
  expiryInfo?: string;
  imageUrl?: string;
}

// Mock AI product database (in production, this would call an API)
const PRODUCT_DATABASE: Record<string, ProductDetails> = {
  '8901030861234': {
    name: 'Dolo 650 Tablet',
    category: 'Analgesics',
    description: 'Paracetamol 650mg tablet for fever and pain relief',
    manufacturer: 'Micro Labs Ltd',
    composition: 'Paracetamol 650mg',
    dosage: '1-2 tablets, 3-4 times daily',
    packSize: '15 tablets',
    mrp: 35.00,
    unitPrice: 32.00,
    hsnCode: '30049099',
    schedule: 'H',
    storage: 'Store below 30°C',
  },
  '8901030861241': {
    name: 'Glycomet 500mg Tablet',
    category: 'Antidiabetics',
    description: 'Metformin 500mg for Type 2 Diabetes',
    manufacturer: 'USV Pvt Ltd',
    composition: 'Metformin Hydrochloride 500mg',
    dosage: 'As prescribed by physician',
    packSize: '10 tablets',
    mrp: 50.00,
    unitPrice: 45.50,
    hsnCode: '30049099',
    schedule: 'H',
    storage: 'Store in a cool, dry place',
  },
  '8901030861258': {
    name: 'Paracetamol 500mg Tablet',
    category: 'Analgesics',
    description: 'Paracetamol 500mg for fever and pain',
    manufacturer: 'Various',
    composition: 'Paracetamol 500mg',
    dosage: '1-2 tablets, 3-4 times daily',
    packSize: '10 tablets',
    mrp: 20.00,
    unitPrice: 15.00,
    hsnCode: '30049099',
    schedule: 'H',
    storage: 'Store below 30°C',
  },
  '810014268668': {
    name: 'Generic Medicine Product',
    category: 'General',
    description: 'Pharmaceutical product',
    manufacturer: 'Generic Manufacturer',
    composition: 'Active ingredients as per formulation',
    dosage: 'As directed by physician',
    packSize: 'Standard pack',
    mrp: 110.00,
    unitPrice: 100.00,
    hsnCode: '30049099',
    schedule: 'H',
    storage: 'Store in a cool, dry place',
  },
  '311845497475': {
    name: 'Vitamin C Tablet',
    category: 'Vitamins & Supplements',
    description: 'Vitamin C (Ascorbic Acid) tablet for immunity and health',
    manufacturer: 'Various manufacturers',
    composition: 'Ascorbic Acid (Vitamin C)',
    dosage: '1-2 tablets daily or as directed by physician',
    packSize: 'Standard pack',
    mrp: 120.00,
    unitPrice: 110.00,
    hsnCode: '30049099',
    schedule: 'H',
    storage: 'Store in a cool, dry place below 30°C, protect from light',
  },
};

// AI Product Lookup Service
export class AIProductLookup {
  /**
   * Lookup product details by barcode using AI and web databases
   */
  static async lookupByBarcode(barcode: string): Promise<ProductDetails | null> {
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Check local database first
    if (PRODUCT_DATABASE[barcode]) {
      return PRODUCT_DATABASE[barcode];
    }

    // Try Drug Library search by barcode (if barcode is stored in drug_library)
    // Note: Drug Library doesn't have barcode field, so we search by brand name patterns
    // In production, you might want to add a barcode field to drug_library
    try {
      const searchResponse = await fetch(`/api/drug-library/search?q=${encodeURIComponent(barcode)}&limit=5`);
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.results && searchData.results.length > 0) {
          const drug = searchData.results[0];
          return {
            name: drug.brandName,
            category: drug.category || 'General',
            description: drug.fullComposition || `Composition: ${drug.salts || 'N/A'}`,
            manufacturer: drug.manufacturer || 'N/A',
            composition: drug.fullComposition || drug.salts || '',
            packSize: drug.packSize || '',
            mrp: drug.priceInr || 100.00,
            unitPrice: drug.priceInr ? (drug.priceInr * 0.9) : 90.00,
            hsnCode: '30049099',
            schedule: drug.schedule || 'H',
            storage: 'Store in a cool, dry place below 30°C',
          };
        }
      }
    } catch (error) {
      console.error('Error searching drug library:', error);
    }

    // Try web-based search
    const webResult = await searchProductByBarcode(barcode);
    
    if (webResult && webResult.confidence > 60) {
      // Convert web result to ProductDetails format
      return {
        name: webResult.name,
        category: webResult.category || 'General',
        description: webResult.description || 'Product found via web search',
        manufacturer: webResult.manufacturer,
        mrp: webResult.mrp || 100.00,
        unitPrice: webResult.mrp ? (webResult.mrp * 0.9) : 90.00,
        hsnCode: '30049099',
        schedule: 'H',
        storage: 'Store in a cool, dry place below 30°C',
      };
    }

    // Fallback to AI-generated details
    const aiGeneratedDetails = await this.generateAIDetails(barcode);
    
    return aiGeneratedDetails;
  }

  /**
   * AI-powered product detail generation
   * In production, this would use GPT/Claude API or similar
   */
  private static async generateAIDetails(barcode: string): Promise<ProductDetails | null> {
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 500));

    // Pattern-based intelligent guessing (in production, use actual AI)
    const barcodeLength = barcode.length;
    
    // For Indian pharmaceutical barcodes (typically 13 digits starting with 890)
    if (barcode.startsWith('890') && barcodeLength === 13) {
      return {
        name: `Pharmaceutical Product ${barcode.slice(-4)}`,
        category: 'General',
        description: 'Pharmaceutical product - details to be verified',
        manufacturer: 'To be determined',
        composition: 'Active ingredients as per formulation',
        dosage: 'As directed by physician',
        packSize: 'Standard pharmaceutical pack',
        mrp: 50.00,
        unitPrice: 45.00,
        hsnCode: '30049099',
        schedule: 'H',
        storage: 'Store in a cool, dry place below 30°C',
      };
    }

    // For 12-digit barcodes (common format)
    if (barcodeLength === 12 && /^\d+$/.test(barcode)) {
      return {
        name: `Medicine Product ${barcode.slice(-6)}`,
        category: 'General',
        description: 'Pharmaceutical product identified by barcode',
        manufacturer: 'To be verified',
        composition: 'Active ingredients as per formulation',
        dosage: 'As directed by physician',
        packSize: 'Standard pharmaceutical pack',
        mrp: 120.00,
        unitPrice: 110.00,
        hsnCode: '30049099',
        schedule: 'H',
        storage: 'Store in a cool, dry place below 30°C',
      };
    }

    // For custom/internal barcodes
    if (barcode.includes(',') || barcode.length < 10) {
      return {
        name: `Product ${barcode}`,
        category: 'General',
        description: 'Product details to be confirmed',
        manufacturer: 'To be determined',
        mrp: 75.00,
        unitPrice: 70.00,
        hsnCode: '30049099',
        schedule: 'H',
        storage: 'Store in a cool, dry place',
      };
    }

    // Generic fallback - better naming
    const lastDigits = barcode.slice(-6);
    return {
      name: `Medicine Product ${lastDigits}`,
      category: 'General',
      description: 'Product information retrieved via AI lookup - please verify details',
      manufacturer: 'Manufacturer details to be verified',
      composition: 'Composition to be confirmed',
      dosage: 'As per prescription',
      packSize: 'Standard pack',
      mrp: 100.00,
      unitPrice: 90.00,
      hsnCode: '30049099',
      schedule: 'H',
      storage: 'Store in a cool, dry place below 30°C',
    };
  }

  /**
   * Search products by name (for manual search)
   */
  static async searchByName(query: string): Promise<ProductDetails[]> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const results: ProductDetails[] = [];
    const lowerQuery = query.toLowerCase();

    // Search in database
    Object.values(PRODUCT_DATABASE).forEach(product => {
      if (product.name.toLowerCase().includes(lowerQuery)) {
        results.push(product);
      }
    });

    // If no results, generate AI suggestions
    if (results.length === 0) {
      results.push({
        name: query,
        category: 'General',
        description: `AI-suggested product: ${query}`,
        mrp: 50.00,
        unitPrice: 45.00,
        hsnCode: '30049099',
        schedule: 'H',
      });
    }

    return results;
  }

  /**
   * Verify product details with enhanced confidence score
   * Returns 100% confidence when all required fields are complete and valid
   */
  static async verifyProduct(barcode: string, details: ProductDetails): Promise<{
    verified: boolean;
    confidence: number;
    suggestions?: string[];
  }> {
    await new Promise(resolve => setTimeout(resolve, 300));

    // Check if barcode exists in database (100% confidence)
    const knownProduct = PRODUCT_DATABASE[barcode];
    
    if (knownProduct) {
      // Compare details
      const matches = {
        name: knownProduct.name === details.name && !details.name.includes("Product"),
        category: knownProduct.category === details.category,
        manufacturer: knownProduct.manufacturer === details.manufacturer && details.manufacturer !== "To be determined",
        composition: knownProduct.composition === details.composition,
        mrp: Math.abs((knownProduct.mrp || 0) - (details.mrp || 0)) < 5,
      };

      const matchCount = Object.values(matches).filter(Boolean).length;
      const confidence = (matchCount / Object.keys(matches).length) * 100;

      return {
        verified: confidence > 80,
        confidence: confidence >= 100 ? 100 : confidence,
        suggestions: confidence < 100 ? ['Some details may need verification'] : undefined,
      };
    }

    // Enhanced confidence calculation based on data completeness
    const fields = {
      name: details.name && !details.name.toLowerCase().includes('product') && !details.name.toLowerCase().includes('generic'),
      manufacturer: details.manufacturer && details.manufacturer !== "To be determined" && details.manufacturer !== "To be verified",
      composition: details.composition && details.composition !== "Active ingredients as per formulation",
      hsnCode: !!details.hsnCode,
      category: details.category && details.category !== "General",
      description: details.description && !details.description.toLowerCase().includes('to be verified'),
    };

    const filledFields = Object.values(fields).filter(Boolean).length;
    const totalFields = Object.keys(fields).length;
    const calculatedConfidence = Math.round((filledFields / totalFields) * 100);

    // If all fields are complete and valid, return 100%
    if (filledFields === totalFields && fields.name && fields.manufacturer && fields.composition) {
      return {
        verified: true,
        confidence: 100,
      };
    }

    // For incomplete products, return calculated confidence
    return {
      verified: calculatedConfidence >= 80,
      confidence: calculatedConfidence,
      suggestions: calculatedConfidence < 80 ? [
        'Product not found in database',
        'Please verify details with manufacturer',
        'Check HSN code and schedule classification',
        'Enter product name from package label',
      ] : ['Verify all details before saving'],
    };
  }
}

