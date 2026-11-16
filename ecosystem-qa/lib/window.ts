import { z } from 'zod';

const REPO = 'storybookjs/storybook';

export const QaStatus = z.enum(['needed', 'skip', 'verified', 'undeclared']);
export type QaStatus = z.infer<typeof QaStatus>;

const STATUS_OF_LABEL: [label: string, status: QaStatus][] = [
  ['qa:success', 'verified'],
  ['qa:needed', 'needed'],
  ['qa:skip', 'skip'],
];

export const qaStatus = (labels: string[]): QaStatus =>
  STATUS_OF_LABEL.find(([label]) => labels.includes(label))?.[1] ?? 'undeclared';

// Danger requires a title of the form `Area: Summary`, both starting with a capital letter.
export const areaOf = (title: string): string | null => /^([A-Z][^:]*):\s/.exec(title)?.[1] ?? null;

const withoutComments = (text: string): string => text.replace(/<!--[^]*?(?:-->|$)/g, '');

export const MANUAL_TESTING_CAP = 3000;

// Cut the way `scripts/dangerfile.ts` finds the section, so a PR that passed Danger has one here.
export const manualTesting = (body: string): string | null => {
  const text = body.replace(/\r\n/g, '\n');
  const heading = /####\s*Manual testing/i.exec(text);
  if (!heading) {
    return null;
  }
  const rest = text.slice(heading.index + heading[0].length);
  const next = /\n#+[^#]/.exec(rest);
  const section = withoutComments(
    (next ? rest.slice(0, next.index) : rest).replace(
      />\s*\[!CAUTION\][^]*?This section is mandatory[^]*?Thanks!/i,
      ''
    )
  ).trim();
  if (!section) {
    return null;
  }
  return section.length > MANUAL_TESTING_CAP
    ? `${section.slice(0, MANUAL_TESTING_CAP).trimEnd()}\n[cut at ${MANUAL_TESTING_CAP} characters]`
    : section;
};

export const hasQaHeading = (body: string): boolean =>
  /^#{1,6}[ \t]+[^\n]*\b(?:QA|testing)\b/im.test(body);

export const mentionedIssues = (body: string): number[] => {
  const text = withoutComments(body);
  const numbers = [
    ...text.matchAll(/(?:^|[^\w/&])#(\d+)\b/g),
    ...text.matchAll(/github\.com\/storybookjs\/storybook\/issues\/(\d+)\b/g),
  ].map((match) => Number(match[1]));
  return [...new Set(numbers)].sort((a, b) => a - b);
};

const AuthorAssociation = z.enum([
  'COLLABORATOR',
  'CONTRIBUTOR',
  'FIRST_TIMER',
  'FIRST_TIME_CONTRIBUTOR',
  'MANNEQUIN',
  'MEMBER',
  'NONE',
  'OWNER',
]);

const IssueFacts = z.strictObject({
  number: z.number(),
  title: z.string(),
  subIssues: z.number(),
  qaHeading: z.boolean(),
});

export const LinkedIssue = IssueFacts.extend({
  closes: z.boolean(),
  parent: IssueFacts.nullable(),
});
export type LinkedIssue = z.infer<typeof LinkedIssue>;

export const WindowPr = z.strictObject({
  number: z.number(),
  title: z.string(),
  area: z.string().nullable(),
  status: QaStatus,
  labels: z.array(z.string()),
  authorAssociation: AuthorAssociation,
  manualTesting: z.string().nullable(),
  issues: z.array(LinkedIssue),
});
export type WindowPr = z.infer<typeof WindowPr>;

export const Window = z.strictObject({
  from: z.string(),
  fromSha: z.string().regex(/^[0-9a-f]{40}$/),
  to: z.string(),
  toSha: z.string().regex(/^[0-9a-f]{40}$/),
  prs: z.array(WindowPr),
});
export type Window = z.infer<typeof Window>;

const MAINTAINERS = new Set(['OWNER', 'MEMBER']);
const PRODUCT_LABELS = new Set(['bug', 'feature request', 'maintenance', 'BREAKING CHANGE']);

// A maintainer marks a PR `qa:skip` when its project gets tested as a whole, so such a PR is
// decided by group.
export const needsGroup = (pr: WindowPr): boolean =>
  pr.status === 'skip' &&
  MAINTAINERS.has(pr.authorAssociation) &&
  pr.labels.some((label) => PRODUCT_LABELS.has(label));

export const PullNode = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string(),
  updatedAt: z.string(),
  mergedAt: z.string(),
  authorAssociation: AuthorAssociation,
  mergeCommit: z.object({ oid: z.string() }).nullable(),
  labels: z.object({ nodes: z.array(z.object({ name: z.string() })) }),
  closingIssuesReferences: z.object({
    nodes: z.array(
      z.object({ number: z.number(), repository: z.object({ nameWithOwner: z.string() }) })
    ),
  }),
});
export type PullNode = z.infer<typeof PullNode>;

const IssueFields = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string(),
  subIssues: z.object({ totalCount: z.number() }),
});

export const IssueNode = z.union([
  IssueFields.extend({ __typename: z.literal('Issue'), parent: IssueFields.nullable() }),
  z.object({ __typename: z.literal('PullRequest') }),
  z.null(),
]);
export type IssueNode = z.infer<typeof IssueNode>;

const DAY_MS = 24 * 60 * 60 * 1000;

// GitHub lists merged PRs by date, not by commit, so the pages stop at a date, and a PR merged
// before it is dropped even when an update listed it early, which keeps the output stable. A
// release tag sits on a version bump branched off next, so the date reaches back past the start.
export const MERGED_BEFORE_START_DAYS = 30;

export const windowCutoff = (startDate: string): string =>
  new Date(Date.parse(startDate) - MERGED_BEFORE_START_DAYS * DAY_MS).toISOString();

export const inWindow = (pr: PullNode, commits: Set<string>, cutoff: string): boolean =>
  pr.mergeCommit !== null &&
  commits.has(pr.mergeCommit.oid) &&
  Date.parse(pr.mergedAt) >= Date.parse(cutoff);

const closedIssues = (pr: PullNode): number[] =>
  pr.closingIssuesReferences.nodes
    .filter((issue) => issue.repository.nameWithOwner === REPO)
    .map((issue) => issue.number);

export const issueNumbersOf = (pr: PullNode): number[] =>
  [...new Set([...closedIssues(pr), ...mentionedIssues(pr.body)])].sort((a, b) => a - b);

const factsOf = (issue: z.infer<typeof IssueFields>) => ({
  number: issue.number,
  title: issue.title,
  subIssues: issue.subIssues.totalCount,
  qaHeading: hasQaHeading(issue.body),
});

export const windowPr = (pr: PullNode, issues: Map<number, IssueNode>): WindowPr => {
  const closes = new Set(closedIssues(pr));
  const labels = pr.labels.nodes.map((label) => label.name).sort();
  return WindowPr.parse({
    number: pr.number,
    title: pr.title,
    area: areaOf(pr.title),
    status: qaStatus(labels),
    labels,
    authorAssociation: pr.authorAssociation,
    manualTesting: manualTesting(pr.body),
    issues: issueNumbersOf(pr).flatMap((number) => {
      const issue = issues.get(number);
      return issue?.__typename === 'Issue'
        ? [
            {
              ...factsOf(issue),
              closes: closes.has(number),
              parent: issue.parent ? factsOf(issue.parent) : null,
            },
          ]
        : [];
    }),
  });
};
