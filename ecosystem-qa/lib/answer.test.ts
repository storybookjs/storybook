import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { answerAfterRepairs, answerOfFinishedAgent } from './answer.ts';

const schema = z.object({ n: z.number() });

const run = (...lines: string[]) =>
  ['', '--- Run started: 2026-11-11T15:27:21.062Z ---', 'Sandcastle Run', ...lines, ''].join('\n');

const answer = (n: unknown) => `<qa-result>\n${JSON.stringify({ n })}\n</qa-result>`;

describe('answerOfFinishedAgent', () => {
  it('returns the answer of an agent that stopped before the sandbox failed', () => {
    const log = run('Agent started', answer(2), 'Agent stopped', 'Collecting commits');

    expect(answerOfFinishedAgent(log, schema)).toEqual({ n: 2 });
  });

  it('finds the block after prose that names the tag', () => {
    const log = run(
      'Agent started',
      'All checks are done, I print the <qa-result> block now.',
      answer(2),
      'Agent stopped'
    );

    expect(answerOfFinishedAgent(log, schema)).toEqual({ n: 2 });
  });

  it('returns the last block when the agent printed two', () => {
    const log = run('Agent started', answer(1), 'more work', answer(2), 'Agent stopped');

    expect(answerOfFinishedAgent(log, schema)).toEqual({ n: 2 });
  });

  it('reads a block whose JSON sits in a Markdown fence', () => {
    const fenced = '<qa-result>\n```json\n{"n":3}\n```\n</qa-result>';
    const log = run('Agent started', fenced, 'Agent stopped');

    expect(answerOfFinishedAgent(log, schema)).toEqual({ n: 3 });
  });

  it('returns undefined when the run failed before its agent started', () => {
    expect(answerOfFinishedAgent(run('Setting up sandbox'), schema)).toBeUndefined();
    expect(answerOfFinishedAgent('', schema)).toBeUndefined();
  });

  it('returns undefined when the agent printed an answer and never stopped', () => {
    const log = run('Agent started', answer(1), 'Agent idle for 15 minutes');

    expect(answerOfFinishedAgent(log, schema)).toBeUndefined();
  });

  it('returns undefined when the agent was started again and did not stop', () => {
    const log = run('Agent started', answer(1), 'Agent stopped', 'Agent started', 'working');

    expect(answerOfFinishedAgent(log, schema)).toBeUndefined();
  });

  it('returns undefined when the agent stopped without a block', () => {
    const log = run('Agent started', 'no answer here', 'Agent stopped');

    expect(answerOfFinishedAgent(log, schema)).toBeUndefined();
  });

  it('returns undefined for broken JSON', () => {
    const log = run('Agent started', '<qa-result>{"n":</qa-result>', 'Agent stopped');

    expect(answerOfFinishedAgent(log, schema)).toBeUndefined();
  });

  it('returns undefined for JSON that fails the schema', () => {
    const log = run('Agent started', answer('x'), 'Agent stopped');

    expect(answerOfFinishedAgent(log, schema)).toBeUndefined();
  });
});

interface Turn {
  stdout: string;
  resume?: (prompt: string) => Promise<Turn>;
}

// An agent whose turns end with the given messages. It can be resumed while a message is left.
const agentEndingTurnsWith = (...messages: string[]) => {
  const prompts: string[] = [];
  const turns: Turn[] = [];
  const take = (index: number): Turn => {
    const turn: Turn = {
      stdout: messages[index]!,
      ...(index + 1 < messages.length
        ? {
            resume: async (prompt: string) => {
              prompts.push(prompt);
              return take(index + 1);
            },
          }
        : {}),
    };
    turns.push(turn);
    return turn;
  };
  return { first: take(0), prompts, turns };
};

describe('answerAfterRepairs', () => {
  it('returns a usable first answer without asking again', async () => {
    const agent = agentEndingTurnsWith(answer(2), answer(3));

    await expect(answerAfterRepairs(agent.first, schema)).resolves.toEqual({
      reading: { answer: { n: 2 } },
      turn: agent.first,
    });
    expect(agent.prompts).toEqual([]);
  });

  it('takes the block of a message that names the tag before it', async () => {
    const agent = agentEndingTurnsWith(`Here is the corrected <qa-result> block:\n${answer(2)}`);

    const { reading } = await answerAfterRepairs(agent.first, schema);

    expect(reading).toEqual({ answer: { n: 2 } });
  });

  it('asks the same session to repair broken JSON and returns the repaired answer', async () => {
    const agent = agentEndingTurnsWith('<qa-result>{"n":2,"}</qa-result>', answer(2));

    const { reading, turn } = await answerAfterRepairs(agent.first, schema);

    expect(reading).toEqual({ answer: { n: 2 } });
    expect(turn).toBe(agent.turns[1]);
    expect(agent.prompts).toHaveLength(1);
    expect(agent.prompts[0]).toContain('The <qa-result> block is not valid JSON');
    expect(agent.prompts[0]).toContain('The text around it: "{\\"n\\":2,\\"}"');
    expect(agent.prompts[0]).toContain('Print the whole corrected <qa-result> block');
  });

  it('names the field that does not fit the schema', async () => {
    const agent = agentEndingTurnsWith(answer('two'), answer(2));

    const { reading } = await answerAfterRepairs(agent.first, schema);

    expect(reading).toEqual({ answer: { n: 2 } });
    expect(agent.prompts[0]).toContain('The <qa-result> block does not fit the schema');
    expect(agent.prompts[0]).toContain('at n');
  });

  it('asks again when the turn ended with a message that has no block', async () => {
    const agent = agentEndingTurnsWith(
      'A background task reported in. My report stands.',
      answer(2)
    );

    const { reading } = await answerAfterRepairs(agent.first, schema);

    expect(reading).toEqual({ answer: { n: 2 } });
    expect(agent.prompts[0]).toContain('It has no <qa-result> block.');
  });

  it('judges each repair by its own message, not by an earlier answer', async () => {
    const agent = agentEndingTurnsWith(answer('a'), 'Nothing to correct.', answer(2));

    const { reading } = await answerAfterRepairs(agent.first, schema);

    expect(reading).toEqual({ answer: { n: 2 } });
    expect(agent.prompts[1]).toContain('It has no <qa-result> block.');
  });

  it('gives up after two repairs and returns the last problem', async () => {
    const agent = agentEndingTurnsWith(answer('a'), answer('b'), answer('c'), answer(2));

    const { reading } = await answerAfterRepairs(agent.first, schema);

    expect(agent.prompts).toHaveLength(2);
    expect(reading).toEqual({ problem: expect.stringContaining('does not fit the schema') });
  });

  it('returns the problem when the session cannot be resumed', async () => {
    const agent = agentEndingTurnsWith(answer('a'));

    const { reading, turn } = await answerAfterRepairs(agent.first, schema);

    expect(reading).toEqual({ problem: expect.stringContaining('does not fit the schema') });
    expect(turn).toBe(agent.first);
  });
});
