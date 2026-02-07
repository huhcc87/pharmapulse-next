import { NextRequest, NextResponse } from 'next/server';
import { getBedrockApiUrl, getBedrockSharedSecret } from '@/config/aws';

/**
 * Bedrock API Endpoint
 * 
 * Server-only proxy that forwards requests to AWS Bedrock API Gateway.
 * This endpoint runs only on the server and does not expose AWS URLs to the browser.
 */

interface BedrockRequest {
  prompt: string;
}

interface BedrockResponse {
  text: string;
  raw?: any;
}

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const body = await request.json() as BedrockRequest;

    if (!body.prompt || typeof body.prompt !== 'string') {
      return NextResponse.json(
        { error: 'Invalid request: prompt is required and must be a string' },
        { status: 400 }
      );
    }

    // Get configuration - return 503 if BEDROCK_API_URL is missing
    let bedrockApiUrl: string;
    try {
      bedrockApiUrl = getBedrockApiUrl();
    } catch (error) {
      return NextResponse.json(
        { error: 'BEDROCK_API_URL not set' },
        { status: 503 }
      );
    }

    const sharedSecret = getBedrockSharedSecret();

    // Build headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Only include x-internal-secret if it's set
    if (sharedSecret) {
      headers['x-internal-secret'] = sharedSecret;
    }

    // Forward request to AWS API Gateway
    const response = await fetch(bedrockApiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt: body.prompt }),
    });

    // Check if the request was successful
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`Bedrock API error: ${response.status} ${response.statusText}`, errorText);
      
      return NextResponse.json(
        { error: 'Failed to process request with Bedrock API' },
        { status: response.status || 500 }
      );
    }

    // Parse response from AWS API Gateway
    const data = await response.json();

    // Extract text from response - prefer raw.text, then try other fields
    const text = 
      data?.text ||
      data?.raw?.text ||
      data?.output?.text ||
      data?.message ||
      data?.content ||
      (typeof data === 'string' ? data : JSON.stringify(data));

    if (!text || typeof text !== 'string') {
      console.error('Invalid response format from Bedrock API:', data);
      return NextResponse.json(
        { error: 'Invalid response format from Bedrock API' },
        { status: 500 }
      );
    }

    // Return response with text and raw data
    const bedrockResponse: BedrockResponse = { 
      text,
      raw: data 
    };
    return NextResponse.json(bedrockResponse, { status: 200 });

  } catch (error) {
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Handle fetch errors (network, timeout, etc.)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Network error calling Bedrock API:', error);
      return NextResponse.json(
        { error: 'Failed to connect to Bedrock API' },
        { status: 500 }
      );
    }

    // Handle other errors
    console.error('Unexpected error in Bedrock API endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Explicitly disable caching for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
