import { inlineTitle } from './proposals.ts';
import { layoutPlan, manualChecksOf, type Plan, prCell } from './qa-plan.ts';
import type { Window } from './window.ts';

const sentenceCase = (text: string) => `${text[0]!.toUpperCase()}${text.slice(1)}`;

// The checklist of a plan's manual checks, for a person to paste into an issue or a discussion, in
// one section for each reason why the sweep cannot test them, and one item for each check, with
// the PRs of every row and group that names it. A PR title is a contributor's text,
// so it goes in as one code span, where GitHub renders no mention or reference.
export const renderManualChecklist = (plan: Plan, window: Window): string => {
  const titleOf = new Map(window.prs.map((pr) => [pr.number, pr.title]));
  const sections = new Map<string, Map<string, number[]>>();
  for (const { why, manual, prs } of manualChecksOf(plan, layoutPlan(plan).at)) {
    const checks = sections.get(why) ?? new Map<string, number[]>();
    checks.set(manual, [...(checks.get(manual) ?? []), ...prs]);
    sections.set(why, checks);
  }
  return [
    `# Manual QA for Storybook ${plan.line} at ${plan.version}`,
    '',
    `Each item is a change in Storybook ${plan.version} that the ecosystem QA sweep cannot test on real projects, with the check a person does by hand instead, under the reason why the sweep cannot test it.`,
    'Tick an item when the check shows what it describes, and when it shows something else, open a bug report with what you did and what you saw, and link it in a comment here.',
    ...[...sections].flatMap(([why, checks]) => [
      '',
      `## ${sentenceCase(why)}`,
      '',
      ...[...checks].flatMap(([manual, prs]) => [
        `- [ ] ${manual}`,
        ...prs.map((pr) => `  - ${prCell(pr)} ${inlineTitle(titleOf.get(pr)!)}`),
      ]),
    ]),
    '',
  ].join('\n');
};
