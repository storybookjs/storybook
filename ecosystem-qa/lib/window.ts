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

export const areaOf = (title: string): string | null => /^([A-Z][^:]*):\s/.exec(title)?.[1] ?? null;

const withoutComments = (text: string): string => text.replace(/<!--[^]*?(?:-->|$)/g, '');

export const MANUAL_TESTING_CAP = 3000;

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

export const PullNode = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string(),
  updatedAt: z.string(),
  mergedAt: z.string(),
  baseRefName: z.string(),
  headRefName: z.string(),
  isCrossRepository: z.boolean(),
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

// A release PR merges the version bump of a tag, so it changes nothing a project can test.
const RELEASE_BASES = new Set(['next-release', 'latest-release']);
// No one rebases these, so a PR merged into one of them keeps its merge commit.
const TRUNKS = new Set(['next', 'main', 'master']);

const mergedSince = (pr: PullNode, cutoff: string) =>
  !RELEASE_BASES.has(pr.baseRefName) && Date.parse(pr.mergedAt) >= Date.parse(cutoff);

// A PR merged into the branch of another PR reaches the range through that PR's merge. Its own
// merge commit is in the range too, unless the branch was rebased or squashed before it merged, so
// such a PR is kept by the branch it was merged into, for as long as that PR had not merged yet.
export const windowPulls = (pulls: PullNode[], commits: Set<string>, cutoff: string) => {
  const kept = new Map(
    pulls
      .filter((pr) => pr.mergeCommit && commits.has(pr.mergeCommit.oid) && mergedSince(pr, cutoff))
      .map((pr) => [pr.number, pr])
  );
  let size: number;
  do {
    size = kept.size;
    const carriers = new Map(
      [...kept.values()]
        .filter((pr) => !pr.isCrossRepository && !TRUNKS.has(pr.headRefName))
        .map((pr) => [pr.headRefName, pr])
    );
    for (const pr of pulls) {
      const carrier = carriers.get(pr.baseRefName);
      if (carrier && mergedSince(pr, cutoff) && pr.mergedAt <= carrier.mergedAt) {
        kept.set(pr.number, pr);
      }
    }
  } while (kept.size > size);
  return [...kept.values()];
};

export const PULLS_QUERY = `query($cursor: String) {
  repository(owner: "storybookjs", name: "storybook") {
    pullRequests(states: MERGED, first: 100, after: $cursor, orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title body updatedAt mergedAt baseRefName headRefName isCrossRepository
        mergeCommit { oid }
        labels(first: 50) { nodes { name } }
        closingIssuesReferences(first: 25) { nodes { number repository { nameWithOwner } } }
      }
    }
  }
}`;

export type PullsPage = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: PullNode[];
};

// Every update comes after the merge, so past the cutoff no PR of the window is left. A PR updated
// while the pages are read moves up the list and shows twice, so the last copy of a number wins.
export const readMergedPulls = (
  readPage: (cursor: string | null) => PullsPage,
  cutoff: string
): PullNode[] => {
  const pulls = new Map<number, PullNode>();
  for (let cursor: string | null = null; ;) {
    const page = readPage(cursor);
    for (const pr of page.nodes) {
      pulls.set(pr.number, pr);
    }
    const oldest = page.nodes.at(-1)?.updatedAt;
    if (!page.pageInfo.hasNextPage || !oldest || Date.parse(oldest) < Date.parse(cutoff)) {
      return [...pulls.values()];
    }
    cursor = page.pageInfo.endCursor;
  }
};

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
