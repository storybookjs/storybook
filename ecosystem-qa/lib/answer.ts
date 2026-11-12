import type { z } from 'zod';

export const QA_RESULT_TAG = 'qa-result';

const BLOCK = new RegExp(`<${QA_RESULT_TAG}>([\\s\\S]*?)</${QA_RESULT_TAG}>`, 'g');
const FENCED = /^```(?:json)?\s*\n(?<body>[\s\S]*?)\n\s*```\s*$/u;

// Sandcastle writes the second line only after the agent process has returned.
const AGENT_STARTED = '\nAgent started\n';
const AGENT_STOPPED = '\nAgent stopped\n';

/**
 * Read the answer of an agent that ran to its end from the Sandcastle log of one run.
 *
 * The agent must have stopped and not been started again. The answer is found the way Sandcastle
 * finds it: the last tagged block, without a Markdown fence around its JSON. Returns undefined when
 * the agent did not finish or the block does not validate.
 */
export const answerOfFinishedAgent = <T>(log: string, schema: z.ZodType<T>): T | undefined => {
  const stopped = log.lastIndexOf(AGENT_STOPPED);
  if (stopped === -1 || log.includes(AGENT_STARTED, stopped)) {
    return undefined;
  }
  const block = [...log.slice(0, stopped).matchAll(BLOCK)].at(-1)?.[1]?.trim();
  if (block === undefined) {
    return undefined;
  }
  try {
    const parsed = schema.safeParse(JSON.parse(FENCED.exec(block)?.groups?.body ?? block));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};
