import type { z } from 'zod';

const BLOCK = /<qa-result>([\s\S]*?)<\/qa-result>/g;

/** Read the agent's answer from the last `<qa-result>` block of a log, or undefined when none validates. */
export const answerFromLog = <T>(log: string, schema: z.ZodType<T>): T | undefined => {
  const block = [...log.matchAll(BLOCK)].at(-1)?.[1];
  if (block === undefined) {
    return undefined;
  }
  try {
    const parsed = schema.safeParse(JSON.parse(block));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};
