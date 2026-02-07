/**
 * AWS Bedrock API Configuration
 * 
 * Centralized configuration for AWS Bedrock API Gateway endpoint.
 * Environment variables:
 * - BEDROCK_API_URL: The AWS API Gateway URL for Bedrock
 * - BEDROCK_SHARED_SECRET: Optional shared secret for authentication
 */

/**
 * Get the Bedrock API URL from environment variables.
 * Throws an error if not configured.
 */
export function getBedrockApiUrl(): string {
  const url = process.env.BEDROCK_API_URL;
  if (!url) {
    throw new Error(
      'BEDROCK_API_URL is not configured. Please set it in your environment variables (.env.local).'
    );
  }
  return url;
}

/**
 * Get the Bedrock shared secret from environment variables.
 * Returns undefined if not configured (optional).
 */
export function getBedrockSharedSecret(): string | undefined {
  return process.env.BEDROCK_SHARED_SECRET;
}
