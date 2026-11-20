import { majorOf } from './cycle.ts';
import { HARNESS_LOGIN } from './github.ts';
import { inlineTitle } from './proposals.ts';
import { layoutPlan, manualChecksOf, type Plan, prCell } from './qa-plan.ts';
import { qaPrefix, trackingTitle } from './tracking.ts';
import type { Window } from './window.ts';

const sentenceCase = (text: string) => `${text[0]!.toUpperCase()}${text.slice(1)}`;

// The checklist of a plan's manual checks, for a person to paste into an issue or a discussion, in
// one section for each reason why the sweep cannot test them, and one item for each check, with
// the PRs of every row and group that names it. A PR title is a contributor's text,
// so it goes in as one code span, where GitHub renders no mention or reference.
export const renderManualChecklist = (plan: Plan, window: Window): string => {
  const titleOf = new Map(window.prs.map((pr) => [pr.number, pr.title]));
  const testedPart = (pr: number) => {
    const slugs = plan.entries.filter((entry) => entry.prs.includes(pr)).map((entry) => entry.slug);
    const named = slugs.map((slug) => `\`${slug}\``).join(', ');
    return slugs.length === 0
      ? ''
      : `, the part that the plan ${slugs.length === 1 ? `entry ${named} does` : `entries ${named} do`} not test`;
  };
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
        ...prs.map((pr) => `  - ${prCell(pr)} ${inlineTitle(titleOf.get(pr)!)}${testedPart(pr)}`),
      ]),
    ]),
    '',
  ].join('\n');
};

// GitHub refuses an issue whose body holds more characters than this.
export const ISSUE_BODY_LIMIT = 65_536;

const MANUAL_MARKER = /^<!-- sb-qa-manual ([0-9a-f]{12}) \S+ -->$/;

// Anyone can open an issue in a public repository, so only an issue of the workflow or of a person
// with a role in the repository can stand for the manual QA of a plan.
const TRUSTED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

export const manualIssueMarker = (hash: string, file: string): string =>
  `<!-- sb-qa-manual ${hash} ${file} -->`;

export type ListedIssue = {
  number: number;
  body: string | null;
  user: { login: string } | null;
  author_association: string;
};

// The issues that hold the manual QA of the plan with this hash, open or closed, oldest first.
export const manualIssuesOf = <Issue extends ListedIssue>(issues: Issue[], hash: string): Issue[] =>
  [...new Map(issues.map((issue) => [issue.number, issue])).values()]
    .filter(
      (issue) =>
        (issue.user?.login === HARNESS_LOGIN ||
          TRUSTED_ASSOCIATIONS.has(issue.author_association)) &&
        MANUAL_MARKER.exec((issue.body ?? '').split(/\r?\n/, 1)[0]!)?.[1] === hash
    )
    .toSorted((a, b) => a.number - b.number);

export type ManualIssuePlan = {
  plan: Plan;
  window: Window;
  file: string;
  hash: string;
  repo: string;
  // The commit that the plan file is linked at.
  commit: string;
};

export type ManualIssue =
  | { create: { title: string; body: string; milestone: string } }
  | { skip: string }
  | { refuse: string };

export const manualIssueOf = ({
  plan,
  window,
  file,
  hash,
  repo,
  commit,
}: ManualIssuePlan): ManualIssue => {
  if (manualChecksOf(plan, layoutPlan(plan).at).length === 0) {
    return { skip: `${file} has no manual checks, so it gets no manual QA issue.` };
  }
  const body = [
    manualIssueMarker(hash, file),
    renderManualChecklist(plan, window),
    '---',
    '',
    `These checks come from the QA plan [\`${file}\`](https://github.com/${repo}/blob/${commit}/ecosystem-qa/plans/${file}).`,
    `The sweep tests the rest of that plan and reports in the discussion \`${trackingTitle(plan.line, file)}\`.`,
    '',
  ].join('\n');
  if (body.length > ISSUE_BODY_LIMIT) {
    return {
      refuse: `The manual QA issue of ${file} would have a body of ${body.length} characters, and GitHub takes at most ${ISSUE_BODY_LIMIT}.`,
    };
  }
  return {
    create: {
      title: `${qaPrefix(plan.line)} Manual QA for Storybook ${plan.line} at ${plan.version}`,
      body,
      milestone: majorOf(plan.line),
    },
  };
};
