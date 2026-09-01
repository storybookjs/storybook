import { describe, expect, it } from 'vitest';

import { compareParser, toCompareOptions } from './options.ts';

// Same test-friendly failure handling as selection.test.ts: parse errors
// throw here instead of printing usage and exiting the process.
function parse(argv: string[], env: NodeJS.ProcessEnv = {}) {
  return toCompareOptions(compareParser(argv, env).fail(false).exitProcess(false).parseSync());
}

describe('the compare CLI grammar', () => {
  it('applies defaults, leaving min-runs unset for the caller to resolve', () => {
    expect(parse([])).toEqual({
      control: undefined,
      cases: [],
      workflows: [],
      plan: undefined,
      minRuns: undefined,
      out: undefined,
    });
  });

  it('parses every flag in the compare wording', () => {
    expect(
      parse([
        '--control=control-none',
        '--cases=do-dont,full',
        '--workflows=701,703',
        '--plan=plans/1-levels-edit.plan.ts',
        '--min-runs=5',
        '--out=/tmp/x',
      ])
    ).toEqual({
      control: 'control-none',
      cases: ['do-dont', 'full'],
      workflows: ['701', '703'],
      plan: 'plans/1-levels-edit.plan.ts',
      minRuns: 5,
      out: '/tmp/x',
    });
  });

  it('accepts the canonical experiment/eval spellings too', () => {
    const options = parse(['--experiments', 'do-dont', '--evals', '703']);
    expect(options.cases).toEqual(['do-dont']);
    expect(options.workflows).toEqual(['703']);
  });

  it('falls back to the AGENTIC_REF_* environment like the other CLIs', () => {
    const options = parse([], {
      AGENTIC_REF_EXPERIMENTS: 'do-dont',
      AGENTIC_REF_EVALS: '703',
      AGENTIC_REF_MIN_RUNS: '7',
    });
    expect(options.cases).toEqual(['do-dont']);
    expect(options.workflows).toEqual(['703']);
    expect(options.minRuns).toBe(7);
  });

  it('lets a flag beat its environment fallback', () => {
    expect(parse(['--min-runs=5'], { AGENTIC_REF_MIN_RUNS: '7' }).minRuns).toBe(5);
  });

  it('rejects unknown arguments and bad min-runs', () => {
    expect(() => parse(['--nope'])).toThrow(/Unknown argument/);
    expect(() => parse(['--all-batches'])).toThrow(/Unknown argument/);
    expect(() => parse(['--min-runs=0'])).toThrow(/must be a positive integer/);
    expect(() => parse(['--min-runs=x'])).toThrow(/must be a positive integer/);
  });
});
