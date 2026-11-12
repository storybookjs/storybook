import type { z } from 'zod';

export const QA_RESULT_TAG = 'qa-result';

const BLOCK = new RegExp(`<${QA_RESULT_TAG}>([\\s\\S]*?)</${QA_RESULT_TAG}>`, 'g');
const FENCED = /^```(?:json)?\s*\n(?<body>[\s\S]*?)\n\s*```\s*$/u;

// Sandcastle appends to the log of an earlier run and opens each run with the first line. It writes
// the last one only after the agent process has returned.
const RUN_STARTED = '\n--- Run started: ';
const AGENT_STARTED = '\nAgent started\n';
const AGENT_STOPPED = '\nAgent stopped\n';

/**
 * Read the answer of an agent that ran to its end from a Sandcastle log.
 *
 * Only the last run in the log counts, and only when its agent stopped and was not started again.
 * The answer is found the way Sandcastle finds it: the last tagged block, without a Markdown fence
 * around its JSON. Returns undefined when the agent did not finish or the block does not validate.
 */
export const answerOfFinishedAgent = <T>(log: string, schema: z.ZodType<T>): T | undefined => {
  const runStart = log.lastIndexOf(RUN_STARTED);
  const run = runStart === -1 ? log : log.slice(runStart);
  const stopped = run.lastIndexOf(AGENT_STOPPED);
  if (stopped === -1 || run.includes(AGENT_STARTED, stopped)) {
    return undefined;
  }
  const block = [...run.slice(0, stopped).matchAll(BLOCK)].at(-1)?.[1]?.trim();
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
