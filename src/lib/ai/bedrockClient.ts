/**
 * Bedrock Client Helper
 * 
 * Client-side helper for calling the Bedrock API route.
 * This calls /api/bedrock (NOT AWS directly) to ensure secrets stay on the server.
 */

interface BedrockApiResponse {
  text: string;
  raw?: any;
}

/**
 * Ask Bedrock a question using the /api/bedrock endpoint.
 * 
 * @param prompt - The prompt/question to send to Bedrock
 * @returns The text response from Bedrock
 * @throws Error if the API request fails
 */
export async function askBedrock(prompt: string): Promise<string> {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt must be a non-empty string');
  }

  try {
    const response = await fetch('/api/bedrock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Bedrock API returned status ${response.status}`);
    }

    const data = await response.json() as BedrockApiResponse;
    
    if (!data.text) {
      throw new Error('Invalid response: missing text field');
    }

    return data.text;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Unexpected error calling Bedrock: ${String(error)}`);
  }
}
