import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { checksFor, renderChecklist } from '../checks.ts';
import type { PlannedRun } from './plan-scope.ts';
import { planCheckId, renderPlanChecks } from './qa-plan.ts';
import { agentOutput, type Tier } from './schema.ts';

const PLAN_PROMPT_FILE = fileURLToPath(new URL('../prompts/plan-checks.md', import.meta.url));

// One list for the answer schema, the checklist and the count the prompt names.
export const checklistOf = (tier: Tier, planned: PlannedRun | undefined, repo: string) => {
  const fixed = checksFor(tier);
  const planChecks = (planned?.entries ?? []).map((entry) => ({
    id: planCheckId(entry.slug),
    label: entry.title,
  }));
  const checks = [...fixed.map(({ id, label }) => ({ id, label })), ...planChecks];
  return {
    checks,
    answerSchema: agentOutput(
      checks.map(({ id }) => id) as [string, ...string[]],
      planChecks.map(({ id }) => id)
    ),
    text: planned
      ? [
          `${renderChecklist(fixed)}\n${renderPlanChecks(planned.entries, repo)}`,
          readFileSync(PLAN_PROMPT_FILE, 'utf8').trim(),
        ].join('\n\n')
      : renderChecklist(fixed),
    fakeFailure:
      planChecks[0]?.id ?? fixed.find(({ id }) => id === 'core.story-render')?.id ?? fixed[0]!.id,
  };
};

export type Checklist = ReturnType<typeof checklistOf>;
