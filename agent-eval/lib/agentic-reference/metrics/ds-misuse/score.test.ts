import { describe, expect, it } from 'vitest';

import { summariseJudgement } from './score.ts';

import type { JudgedNode } from './types.ts';

function dsNode(decision: 0 | 0.5 | 1, usage: 0 | 0.5 | 1): JudgedNode {
  return {
    path: 'App/Button[0]',
    file: 'src/App.tsx',
    line: 1,
    tag: 'Button',
    kind: 'ds',
    correctDsDecision: { score: decision, reasons: [{ text: 'r' }] },
    correctDsUsage: { score: usage, reasons: [{ text: 'r' }] },
  };
}

function localNode(decision: 0 | 0.5 | 1): JudgedNode {
  return {
    path: 'App/Row[0]',
    file: 'src/App.tsx',
    line: 2,
    tag: 'Row',
    kind: 'local',
    correctLocalDecision: { score: decision, reasons: [{ text: 'r' }] },
  };
}

describe('summariseJudgement', () => {
  it('means each score over the nodes that received it', () => {
    expect(summariseJudgement([dsNode(1, 1), dsNode(0, 0.5), localNode(1)])).toEqual({
      correctDsDecision: 0.5,
      correctDsUsage: 0.75,
      correctLocalDecision: 1,
      evaluated: { ds: 2, local: 1 },
    });
  });

  // null, not 0: "the run created no local components" and "every local
  // decision was wrong" are different findings and must not read the same.
  it('returns null for a score no node received', () => {
    expect(summariseJudgement([dsNode(1, 1)])).toMatchObject({
      correctLocalDecision: null,
      evaluated: { ds: 1, local: 0 },
    });
  });

  it('returns all nulls for an empty judgement', () => {
    expect(summariseJudgement([])).toEqual({
      correctDsDecision: null,
      correctDsUsage: null,
      correctLocalDecision: null,
      evaluated: { ds: 0, local: 0 },
    });
  });

  it('rounds to four decimals, matching how coverage stores shares', () => {
    expect(summariseJudgement([dsNode(1, 1), dsNode(1, 1), dsNode(0, 0)]).correctDsDecision).toBe(
      0.6667
    );
  });
});
