/**
 * AWS Bedrock API Client
 * 
 * Service for making requests to AWS Bedrock via API Gateway.
 */

import { BEDROCK_API_URL } from '@/config/aws';

export interface BedrockResponse {
  [key: string]: unknown;
}

/**
 * Calls the AWS Bedrock API Gateway endpoint with a prompt.
 * 
 * @param prompt - The text prompt to send to the Bedrock model
 * @returns Parsed JSON response from the API
 * @throws Error if the API request fails or returns non-OK status
 */
export async function callBedrock(prompt: string): Promise<BedrockResponse> {
  if (!BEDROCK_API_URL) {
    throw new Error('BEDROCK_API_URL is not configured. Please set it in your environment variables.');
  }

  const apiKey = process.env.BEDROCK_API_KEY;
  if (!apiKey) {
    throw new Error('BEDROCK_API_KEY is not set. Please configure it in your environment variables.');
  }

  try {
    const response = await fetch(BEDROCK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Bedrock API request failed: ${response.status} ${response.statusText}. ${errorText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Unexpected error calling Bedrock API: ${String(error)}`);
  }
}
