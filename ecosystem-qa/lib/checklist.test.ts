import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { checklistOf } from './checklist.ts';
import { plannedRun, planScopeOf, type PlannedRun, type PlanScope } from './plan-scope.ts';

const scope = planScopeOf(
  'ecosystem-qa/lib/plan.fixture.md',
  readFileSync(new URL('./plan.fixture.md', import.meta.url)),
  { batch: '1' }
) as PlanScope;
const planned = plannedRun(scope, {
  repo: 'mealdrop',
  version: '11.0.0-beta.3',
  part: '1',
}) as PlannedRun;

const answerOf = (checks: { id: string; label: string }[], note?: string) => ({
  storybookVersionBefore: '10.6.0',
  storybookVersionInstalled: '11.0.0-beta.3',
  checks: checks.map(({ id, label }) => ({ id, label, state: 'pass', note })),
  findings: [],
});

describe('checklistOf', () => {
  it('gives the answer of a plan run the rules of its plan checks', () => {
    const { checks, answerSchema } = checklistOf('gate', planned, 'mealdrop');
    const planIds = checks.map(({ id }) => id).filter((id) => id.startsWith('plan.'));

    expect(planIds.length).toBeGreaterThan(0);
    expect(answerSchema.safeParse(answerOf(checks, 'Saw it')).success).toBe(true);
    expect(
      answerSchema.safeParse(answerOf(checks)).error?.issues.map(({ message }) => message)
    ).toEqual(planIds.map((id) => `plan check "${id}" needs a note with what you saw`));
  });

  it('asks a static run for no note', () => {
    const { checks, answerSchema } = checklistOf('must', undefined, 'mealdrop');

    expect(answerSchema.safeParse(answerOf(checks)).success).toBe(true);
  });
});
