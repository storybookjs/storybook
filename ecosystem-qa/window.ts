import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { z } from 'zod';

import { ghParse } from './lib/github.ts';
import {
  IssueNode,
  issueNumbersOf,
  inWindow,
  needsGroup,
  PullNode,
  QaStatus,
  Window,
  windowCutoff,
  windowPr,
} from './lib/window.ts';

const HELP = `Usage: node ecosystem-qa/window.ts --from <tag> --to <tag> --out <file>

Writes every PR merged into next between two tags to --out as JSON, sorted by number: its QA status,
its area, its manual testing section, who wrote it as GitHub's author association, and the issues
it closes or names in its body, each with its parent issue, its number of sub-issues, and whether it
has a heading for QA or testing. Prints the count of each status. Reads git and GitHub only.`;

const { values } = parseArgs({
  options: {
    from: { type: 'string' },
    to: { type: 'string' },
    out: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(HELP);
  process.exit(0);
}
const { from, to, out } = values;
if (!from || !to || !out) {
  console.error(`Missing one of --from, --to, --out.\n\n${HELP}`);
  process.exit(1);
}

const git = (...args: string[]): string =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 }).trim();

const commitOf = (tag: string): string => {
  const ref = `refs/tags/${tag}^{commit}`;
  try {
    return git('rev-parse', '--verify', '--quiet', ref);
  } catch {
    git('fetch', 'origin', 'tag', tag, '--no-tags');
    return git('rev-parse', '--verify', ref);
  }
};

const fromSha = commitOf(from);
const toSha = commitOf(to);
const commits = new Set(git('rev-list', `${fromSha}..${toSha}`).split('\n'));
const cutoff = windowCutoff(git('log', '-1', '--format=%cI', fromSha));

const PULLS_QUERY = `query($cursor: String) {
  repository(owner: "storybookjs", name: "storybook") {
    pullRequests(states: MERGED, baseRefName: "next", first: 100, after: $cursor, orderBy: { field: UPDATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title body updatedAt mergedAt authorAssociation
        mergeCommit { oid }
        labels(first: 50) { nodes { name } }
        closingIssuesReferences(first: 25) { nodes { number repository { nameWithOwner } } }
      }
    }
  }
}`;

const PullsPage = z.object({
  data: z.object({
    repository: z.object({
      pullRequests: z.object({
        pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
        nodes: z.array(PullNode),
      }),
    }),
  }),
});

const readPage = (cursor: string | null) =>
  ghParse(PullsPage, [
    'api',
    'graphql',
    '-f',
    `query=${PULLS_QUERY}`,
    ...(cursor ? ['-f', `cursor=${cursor}`] : []),
  ]).data.repository.pullRequests;

const pulls: PullNode[] = [];
for (let cursor: string | null = null; ;) {
  const page = readPage(cursor);
  pulls.push(...page.nodes);
  // Every update comes after the merge, so past the cutoff no PR of the window is left.
  const oldest = page.nodes.at(-1)?.updatedAt;
  if (!page.pageInfo.hasNextPage || !oldest || Date.parse(oldest) < Date.parse(cutoff)) {
    break;
  }
  cursor = page.pageInfo.endCursor;
}
// A PR updated while the pages are read moves up the list and shifts the next page by one.
const inRange = [...new Map(pulls.map((pr) => [pr.number, pr])).values()].filter((pr) =>
  inWindow(pr, commits, cutoff)
);

const ISSUE_FIELDS = 'number title body subIssues { totalCount }';
const ISSUES_PER_QUERY = 100;

const IssuesAnswer = z.object({
  data: z.object({ repository: z.record(z.string(), IssueNode) }),
});
const NotFoundOnly = z.object({
  errors: z.array(z.object({ type: z.literal('NOT_FOUND'), message: z.string() })),
});

// A number in a body can name nothing. GitHub then answers that alias with null and an error, and gh
// exits 1 and prints the error's message on stderr, which is noise here. Any other line of stderr,
// the GH_DEBUG trace included, still reaches the terminal.
const askIssues = (args: string[]): unknown => {
  const { status, stdout, stderr, error } = spawnSync('gh', args, {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
  if (error) {
    throw error;
  }
  let answer: unknown;
  try {
    answer = JSON.parse(stdout);
  } catch {
    answer = undefined;
  }
  const notFound = status === 0 ? undefined : NotFoundOnly.safeParse(answer);
  const noise = new Set(
    notFound?.data?.errors.flatMap(({ message }) => [message, `gh: ${message}`]) ?? []
  );
  process.stderr.write(
    stderr
      .split('\n')
      .filter((line) => !noise.has(line))
      .join('\n')
  );
  if (status !== 0 && !notFound?.success) {
    throw new Error(`gh ${args.slice(0, 2).join(' ')} exited ${status}.`);
  }
  return answer;
};

const lookUpIssues = (numbers: number[]): [number, IssueNode][] => {
  const aliases = numbers
    .map(
      (number) =>
        `i${number}: issueOrPullRequest(number: ${number}) { __typename ... on Issue { ${ISSUE_FIELDS} parent { ${ISSUE_FIELDS} } } }`
    )
    .join('\n');
  const answer = askIssues([
    'api',
    'graphql',
    '-f',
    `query=query { repository(owner: "storybookjs", name: "storybook") { ${aliases} } }`,
  ]);
  const found = IssuesAnswer.parse(answer).data.repository;
  return numbers.map((number) => [number, found[`i${number}`] ?? null]);
};

const wanted = [...new Set(inRange.flatMap(issueNumbersOf))].sort((a, b) => a - b);
const issues = new Map<number, IssueNode>();
for (let start = 0; start < wanted.length; start += ISSUES_PER_QUERY) {
  for (const [number, issue] of lookUpIssues(wanted.slice(start, start + ISSUES_PER_QUERY))) {
    issues.set(number, issue);
  }
}

const window = Window.parse({
  from,
  fromSha,
  to,
  toSha,
  prs: inRange.map((pr) => windowPr(pr, issues)).sort((a, b) => a.number - b.number),
});
writeFileSync(out, `${JSON.stringify(window, null, 2)}\n`);

const counts = QaStatus.options.map(
  (status) => `${window.prs.filter((pr) => pr.status === status).length} ${status}`
);
console.log(
  `${window.prs.length} PRs: ${counts.join(', ')}. ${window.prs.filter(needsGroup).length} maintainer PRs marked qa:skip need a group.`
);
