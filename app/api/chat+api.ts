// Import the API key from our constants file instead of using dotenv
import { GOOGLE_GENERATIVE_AI_API_KEY, TEST_VARIABLE } from '../../constants/api-keys';

// Import core dependencies
import { google } from '@ai-sdk/google';
import { generateText, CoreMessage } from 'ai';

// Log the API key status for debugging
console.log('Environment check via constants:', { 
  hasApiKey: !!GOOGLE_GENERATIVE_AI_API_KEY,
  hasTestVariable: !!TEST_VARIABLE,
  testVariableValue: TEST_VARIABLE
});

// We're now using directly imported constants instead of process.env
// Log when the module is loaded to verify it's being executed
console.log('=== API ROUTE LOADED [' + new Date().toISOString() + '] ===');
console.log('Environment check:', {
  hasApiKey: !!GOOGLE_GENERATIVE_AI_API_KEY,
});

// Helper to log details about the request for debugging
function logRequestDetails(req: Request, method: string) {
  const url = new URL(req.url);
  console.log(`
=== ${method} REQUEST [${new Date().toISOString()}] ===`);
  console.log('URL:', req.url);
  console.log('Path:', url.pathname);
  console.log('Origin:', req.headers.get('origin'));
  console.log('Host:', req.headers.get('host'));
  console.log('User-Agent:', req.headers.get('user-agent'));
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
}

// CORS headers helper - simplified and explicit
function corsHeaders(req: Request) {
  const origin = req.headers.get('origin');
  console.log(`Setting CORS headers for origin: ${origin || 'unknown'}`);
  
  // Create a Headers object rather than returning a plain object
  const headers = new Headers();
  
  // Set CORS headers explicitly
  headers.set('Access-Control-Allow-Origin', '*'); // Use wildcard for testing
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
  
  return headers;
}

// Handle preflight requests
export async function OPTIONS(req: Request) {
  logRequestDetails(req, 'OPTIONS');
  
  // Use our helper to get a consistent set of CORS headers
  const headers = corsHeaders(req);
  
  console.log('Responding to OPTIONS with headers:', Object.fromEntries(headers.entries()));
  
  return new Response(null, {
    status: 204,
    headers,
  });
}

// Simple GET endpoint for testing
export async function GET(req: Request) {
  logRequestDetails(req, 'GET');
  
  // Create the response payload
  const responseBody = JSON.stringify({ 
    status: 'ok', 
    message: 'API is working', 
    timestamp: new Date().toISOString()
  });
  
  // Get the CORS headers
  const headers = corsHeaders(req);
  
  // Add Content-Type header
  headers.set('Content-Type', 'application/json');
  
  console.log('Responding to GET with headers:', Object.fromEntries(headers.entries()));
  
  return new Response(responseBody, {
    status: 200,
    headers,
  });
}

// Gemini streaming backend implementation
// These imports are now at the top of the file

export async function POST(req: Request) {
  logRequestDetails(req, 'POST');

  try {
    // Use our imported constant instead of process.env
    const apiKey = GOOGLE_GENERATIVE_AI_API_KEY;
    
    // Parse the incoming request using req.json()
    let prompt = '';
    try {
      const data = await req.json();
      console.log('Received request data:', data);

      if (!data || typeof data.message !== 'string') {
        console.error('Invalid request: message is missing or not a string.', data);
        return new Response(JSON.stringify({ error: 'Message must be a string and is required.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      prompt = data.message;
      // Limit prompt length for safety
      if (prompt.length > 1000) {
        prompt = prompt.substring(0, 1000);
        console.log('Prompt truncated to 1000 characters');
      }
    } catch (err) {
      console.error('Failed to parse request body as JSON:', err);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (!prompt) {
      console.error('No prompt provided');
      return new Response(JSON.stringify({ error: 'No prompt/message provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if API key is loaded
    if (!apiKey) {
      console.error('Gemini API key is not loaded from constants.');
      // Return a 503 Service Unavailable error as the service is not configured
      return new Response(JSON.stringify({ error: 'API key not configured. Service unavailable.' }), {
        status: 503, 
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Set the API key in process.env for the Vercel AI SDK to pick up.
    // This should be done early, before the SDK model provider is invoked.
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;
    console.log('GOOGLE_GENERATIVE_AI_API_KEY set in process.env');
    console.log('Using API key (from constants):', apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4));

    console.log('Sending prompt to Gemini:', prompt);
    
    try {
      // Call Gemini API directly with the correct parameters.
      // The google() helper expects the model ID. The API key is picked from process.env.
      const result = await generateText({
        model: google('gemini-2.0-flash'), // Use a valid model ID string
        prompt
      });
      
      console.log('Received response from Gemini');
      console.log('Result structure:', Object.keys(result).join(', '));

      // Extract text from the generateText result
      console.log('Available properties in generateText result:', Object.keys(result));
      
      let text: string = '';
      const anyResult = result as any; // Use 'as any' for now, or type with GenerateTextResult

      if (typeof anyResult.text === 'string') {
        text = anyResult.text;
        console.log('Successfully extracted string from generateText result.text.');
      } else {
        console.error(`generateText result.text is not a string. Type: ${typeof anyResult.text}, Value:`, anyResult.text);
        console.error('Full generateText result object:', JSON.stringify(result, null, 2));
        text = `Error: AI response format unexpected after using generateText. Prompt: ${prompt}`;
      }

      // Additional logging for other potentially useful fields from GenerateTextResult
      if (anyResult.finishReason) {
        console.log('Finish Reason:', anyResult.finishReason);
      }
      if (anyResult.usage) {
        console.log('Token Usage:', anyResult.usage);
      }
      
      console.log('Text type:', typeof text);
      if (typeof text === 'string') {
        console.log('Received text from Gemini:', text.length > 100 ? text.substring(0, 100) + '...' : text);
      } else {
        console.log('Text is not a string:', text);
        text = String(text); // Convert to string for safety
      }

      // Set up CORS headers
      const headers = corsHeaders(req);
      headers.set('Content-Type', 'application/json');

      // Return the text as a simple JSON response
      return new Response(JSON.stringify({ response: text }), {
        status: 200,
        headers,
      });
    } catch (geminiError) {
      console.error('Error calling Gemini API:', geminiError);
      const headers = corsHeaders(req);
      headers.set('Content-Type', 'application/json');
      return new Response(JSON.stringify({
        error: 'Gemini API error',
        message: geminiError instanceof Error ? geminiError.message : String(geminiError),
        timestamp: new Date().toISOString(),
      }), {
        status: 500,
        headers,
      });
    }
  } catch (error: any) { // Use 'any' for broader error inspection
    console.error('Error in POST handler:', error);
    let errorMessage = 'Failed to process chat request';
    let statusCode = 500;

    // Check for API key or authentication related errors
    if (error.message && error.message.toLowerCase().includes('api key')) {
      errorMessage = 'API Key error: ' + error.message;
      statusCode = 401; // Unauthorized
      console.error('Potential API Key issue detected.');
    } else if (error.cause) {
      // Some SDKs wrap errors in a 'cause' property
      console.error('Error Cause:', error.cause);
      if (typeof error.cause === 'object' && error.cause !== null && 'message' in error.cause) {
        const causeMessage = (error.cause as { message: string }).message;
        if (causeMessage.toLowerCase().includes('api key')) {
          errorMessage = 'API Key error (from cause): ' + causeMessage;
          statusCode = 401;
          console.error('Potential API Key issue detected from error.cause.');
        }
      }
    }
    
    // Log the full error object for more details if available
    if (typeof error === 'object' && error !== null) {
      // Attempt to stringify, but handle circular references or large objects
      try {
        console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch (stringifyError) {
        console.error('Could not stringify full error object:', stringifyError, 'Logging basic error properties instead.');
        console.error('Error message:', error.message);
        console.error('Error name:', error.name);
        console.error('Error stack:', error.stack);
      }
    }

    // Ensure CORS headers are set even for errors
    const headers = corsHeaders(req);
    headers.set('Content-Type', 'application/json');
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: statusCode,
      headers,
    });
  }
}