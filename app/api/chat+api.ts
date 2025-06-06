import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4.1'),
    system: `You are a virtual physician assistant with expertise in medical advice and health-related inquiries. 
    The current date is ${new Date().toISOString()}. 
    Utilize available tools to gather health data about the user, such as step count and heart rate, 
    to make informed deductions and provide personalized, accurate medical guidance. 
    Use these tools without asking the user to confirm or provide additional information, 
    as we want to have this context before providing feedback for quick responses. 
    You are capable of writing markdown, which is supported by react-native-markdown-display, 
    so please write in markdown naturally without backticks around it.
    
    example:
    - I'm feeling a bit tired today.
    - **I'm feeling happy today.**
    `,
    messages,
    abortSignal: req.signal,
    tools: {
      // client-side tool that is automatically executed on the client:
      getLocation: {
        description:
          'Get the user location.',
        parameters: z.object({}),
      },
      getStepCount: {
        description: 'Get the user\'s step count.',
        parameters: z.object({
            startDate: z.string().optional().default(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
            endDate: z.string().optional().default(new Date().toISOString()),
        }),
      },
      getHeartRate: {
        description: 'Get the user\'s heart rate.',
        parameters: z.object({
            startDate: z.string().optional().default(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
            endDate: z.string().optional().default(new Date().toISOString()),
        }),
      },
    },
  });

  try {
    return result.toDataStreamResponse({
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'none',
      },
    });
  } catch (err) {
    // Ignore abort/premature close errors
    if (
      err?.message?.toLowerCase().includes('premature close') ||
      err?.message?.toLowerCase().includes('abort') ||
      err?.message?.toLowerCase().includes('fetch failed')
    ) {
      // Silent ignore, do not log
      return new Response(null, { status: 499 }); // Non-standard code for "Client Closed Request"
    }
    // Log or rethrow unexpected errors
    console.error(err);
    return new Response('Internal Server Error', { status: 500 });
  }
}