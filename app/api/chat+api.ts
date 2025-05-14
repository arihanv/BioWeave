import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4.1'),
    system: `You are a helpful assistant that can answer questions and help with tasks. The current date is ${new Date().toISOString()}`,
    messages,
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
            startDate: z.string().optional(),
            endDate: z.string().optional().default(new Date().toISOString()),
        }),
      },
    },
  });

  return result.toDataStreamResponse({
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'none',
    },
  });
}