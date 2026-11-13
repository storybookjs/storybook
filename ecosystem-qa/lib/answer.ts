import { z } from 'zod';

export const QA_RESULT_TAG = 'qa-result';

const OPEN = `<${QA_RESULT_TAG}>`;
const CLOSE = `</${QA_RESULT_TAG}>`;
const FENCED = /^```(?:json)?\s*\n(?<body>[\s\S]*?)\n\s*```\s*$/u;

// Sandcastle writes the second line only after the agent process has returned.
const AGENT_STARTED = '\nAgent started\n';
const AGENT_STOPPED = '\nAgent stopped\n';

const REPAIRS = 2;

type Reading<T> = { answer: T } | { problem: string };

const syntaxProblem = (body: string, error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  const position = Number(/position (\d+)/.exec(message)?.[1]);
  return Number.isInteger(position)
    ? `${message}. The text around it: ${JSON.stringify(body.slice(Math.max(0, position - 80), position + 80))}`
    : message;
};

// An agent also names the tag in prose before it prints the block, so the block is searched from
// its end: the last closing tag, and the last opening tag before that.
const lastBlock = (text: string): string | undefined => {
  const close = text.lastIndexOf(CLOSE);
  const open = close === -1 ? -1 : text.lastIndexOf(OPEN, close);
  return open === -1 ? undefined : text.slice(open + OPEN.length, close).trim();
};

// A block that cannot be used comes back as the problem to tell the agent.
const readAnswer = <T>(text: string, schema: z.ZodType<T>): Reading<T> => {
  const block = lastBlock(text);
  if (block === undefined) {
    return { problem: `It has no <${QA_RESULT_TAG}> block.` };
  }
  const body = FENCED.exec(block)?.groups?.body ?? block;
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch (error) {
    return {
      problem: `The <${QA_RESULT_TAG}> block is not valid JSON: ${syntaxProblem(body, error)}`,
    };
  }
  const parsed = schema.safeParse(json);
  return parsed.success
    ? { answer: parsed.data }
    : {
        problem: `The <${QA_RESULT_TAG}> block does not fit the schema:\n${z.prettifyError(parsed.error)}`,
      };
};

const repairPrompt = (problem: string) =>
  [
    'Your answer could not be used.',
    '',
    problem,
    '',
    `Print the whole corrected <${QA_RESULT_TAG}> block and nothing else. Do not change files or run commands.`,
  ].join('\n');

interface AgentTurn<Self> {
  // The last message of the turn.
  stdout: string;
  resume?: (prompt: string) => Promise<Self>;
}

// Ask the agent, in the session it answered in, to repair an answer that cannot be used.
//
// Only the last message of a turn counts as its answer. An agent that kept working after a block
// may have changed its mind, and asking it again costs one turn. Gives up after two repairs, or
// when the session cannot be resumed, and then returns the last problem.
export const answerAfterRepairs = async <T, Turn extends AgentTurn<Turn>>(
  first: Turn,
  schema: z.ZodType<T>
): Promise<{ reading: Reading<T>; turn: Turn }> => {
  let turn = first;
  let reading = readAnswer(turn.stdout, schema);
  for (let left = REPAIRS; 'problem' in reading && left > 0 && turn.resume; left -= 1) {
    turn = await turn.resume(repairPrompt(reading.problem));
    reading = readAnswer(turn.stdout, schema);
  }
  return { reading, turn };
};

// Read the answer of an agent that ran to its end from the Sandcastle log of one run.
//
// The agent must have stopped and not been started again. Returns undefined when the agent did not
// finish or its answer cannot be used.
export const answerOfFinishedAgent = <T>(log: string, schema: z.ZodType<T>): T | undefined => {
  const stopped = log.lastIndexOf(AGENT_STOPPED);
  if (stopped === -1 || log.includes(AGENT_STARTED, stopped)) {
    return undefined;
  }
  const reading = readAnswer(log.slice(0, stopped), schema);
  return 'answer' in reading ? reading.answer : undefined;
};
