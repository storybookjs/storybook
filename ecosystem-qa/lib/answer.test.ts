import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { answerOfFinishedAgent } from './answer.ts';

const schema = z.object({ n: z.number() });

const run = (...lines: string[]) =>
  ['', '--- Run started: 2026-11-11T15:27:21.062Z ---', 'Sandcastle Run', ...lines, ''].join('\n');

const answer = (n: unknown) => `<qa-result>\n${JSON.stringify({ n })}\n</qa-result>`;

describe('answerOfFinishedAgent', () => {
  it('returns the answer of an agent that stopped before the sandbox failed', () => {
    const log = run('Agent started', answer(2), 'Agent stopped', 'Collecting commits');

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
