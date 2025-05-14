import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { z } from 'zod';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4.1'),
    system: `You are a virtual physician assistant with expertise in medical advice and health-related inquiries. The current date is ${new Date().toISOString()}. Utilize available tools to gather health data about the user, such as step count and heart rate, to make informed deductions and provide personalized, accurate medical guidance. Use these tools without asking the user to confirm or provide additional information as we want to have this context before we say something for quick feedback.`,
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

  return result.toDataStreamResponse({
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'none',
    },
  });
}