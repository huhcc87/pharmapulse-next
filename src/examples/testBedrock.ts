/**
 * Test Bedrock Client
 * 
 * Example usage of the Bedrock API client service.
 * Run with: npx tsx src/examples/testBedrock.ts
 */

import { callBedrock } from '@/services/bedrockClient';

async function testBedrock() {
  try {
    const testPrompt = 'Hello, how are you?';
    
    console.log('Calling Bedrock API with prompt:', testPrompt);
    const response = await callBedrock(testPrompt);
    
    // Extract and log only the model text output
    // Adjust this based on your actual API response structure
    const modelOutput = 
      (response as { text?: string })?.text ||
      (response as { output?: string })?.output ||
      (response as { message?: string })?.message ||
      (response as { content?: string })?.content ||
      JSON.stringify(response);
    
    console.log('\nModel Output:');
    console.log(modelOutput);
  } catch (error) {
    console.error('Error testing Bedrock:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testBedrock();
}
