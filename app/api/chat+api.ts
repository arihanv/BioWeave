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
      const { messages } = await req.json();
      // The useChat hook sends the whole conversation history.
      // The last message is the user's current input.
      const userQuery = messages && messages.length > 0 ? messages[messages.length - 1].content : '';

      if (!userQuery) {
        return new Response(JSON.stringify({ error: 'No message found in request' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
      prompt = userQuery;
      console.log('Received request data:', { messages });

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
    
    // Call RAG API
    const ragApiUrl = 'http://127.0.0.1:8000/query'; // Ensure your RAG API is running here
    console.log(`Attempting to call RAG API at ${ragApiUrl} with query: "${prompt}"`);

    try {
      const ragApiResponse = await fetch(ragApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: prompt, top_k: 3 }), // top_k can be made configurable
      });

      const responseHeaders = corsHeaders(req); // Get base CORS headers
      responseHeaders.set('Content-Type', 'application/json'); // Set content type for all responses from here

      if (!ragApiResponse.ok) {
        const errorBodyText = await ragApiResponse.text(); 
        console.error(`RAG API call failed: ${ragApiResponse.status} ${ragApiResponse.statusText}. Body: ${errorBodyText}`);
        let errorDetail = `RAG API error: ${ragApiResponse.status} ${ragApiResponse.statusText}. ${errorBodyText}`;
        try {
            const errorJson = JSON.parse(errorBodyText);
            if (errorJson.detail) errorDetail = `RAG API error: ${errorJson.detail}`;
            else if (errorJson.error) errorDetail = `RAG API error: ${errorJson.error}`;
        } catch (e) { /* Not a JSON error body, stick with text */ }

        return new Response(JSON.stringify({ error: errorDetail }), {
          status: ragApiResponse.status, 
          headers: responseHeaders,
        });
      }

      const ragData = await ragApiResponse.json();
      console.log('Received successful response from RAG API:', ragData);

      const finalAnswer = ragData.answer;
      const retrievedChunks = ragData.retrieved_chunks; 

      console.log('Responding to POST with RAG API answer. Headers:', Object.fromEntries(responseHeaders.entries()));
      
      return new Response(JSON.stringify({ text: finalAnswer, retrieved_chunks: retrievedChunks }), {
        status: 200,
        headers: responseHeaders,
      });

    } catch (ragCallError: any) {
      console.error('Network or other error calling RAG API:', ragCallError);
      const responseHeaders = corsHeaders(req);
      responseHeaders.set('Content-Type', 'application/json');
      return new Response(JSON.stringify({ error: `Failed to connect to RAG API: ${ragCallError.message}` }), {
        status: 502, // Bad Gateway, as this service depends on the RAG API
        headers: responseHeaders,
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