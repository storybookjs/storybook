import { describe, expect, it } from 'vitest';

import {
  areaOf,
  type IssueNode,
  MANUAL_TESTING_CAP,
  manualTesting,
  PullNode,
  PULLS_QUERY,
  type PullsPage,
  qaStatus,
  readMergedPulls,
  windowCutoff,
  windowPr,
  windowPulls,
} from './window.ts';

const MERGE = 'a'.repeat(40);

const pull = (extra: object = {}): PullNode =>
  PullNode.parse({
    number: 36137,
    title: 'Core: Replace preview storySort with chained storySorts in main',
    body: '',
    updatedAt: '2026-10-02T10:00:00Z',
    mergedAt: '2026-10-01T10:00:00Z',
    baseRefName: 'next',
    headRefName: 'story-sort-in-main',
    isCrossRepository: false,
    mergeCommit: { oid: MERGE },
    labels: { nodes: [{ name: 'qa:skip' }, { name: 'bug' }] },
    closingIssuesReferences: { nodes: [] },
    ...extra,
  });

const issue = (number: number, extra: object = {}) => ({
  number,
  title: `Issue ${number}`,
  body: '### Describe the bug\n\nIt breaks.',
  subIssues: { totalCount: 0 },
  ...extra,
});

describe('qaStatus', () => {
  it.each([
    [['qa:needed', 'bug'], 'needed'],
    [['qa:skip'], 'skip'],
    [['qa:success', 'feature request'], 'verified'],
    [['bug'], 'undeclared'],
  ])('reads %j as %s', (labels, status) => {
    expect(qaStatus(labels)).toBe(status);
  });

  it('reads a PR verified by hand as verified, even when it still carries qa:needed', () => {
    expect(qaStatus(['qa:needed', 'qa:success'])).toBe('verified');
  });
});

describe('windowPr', () => {
  // GitHub answers the author association by what the reading token may see, and a bot or an
  // outside author marks PRs qa:skip too, so the window keeps nothing of who wrote a PR.
  it.each(['MEMBER', 'CONTRIBUTOR', 'NONE'])(
    'records the same fields for a PR whose author GitHub associates as %s',
    (authorAssociation) => {
      const pr = windowPr(
        pull({ authorAssociation, author: { login: 'obvious-autobuild', __typename: 'Bot' } }),
        new Map()
      );

      expect(Object.keys(pr)).toEqual([
        'number',
        'title',
        'area',
        'status',
        'labels',
        'manualTesting',
        'issues',
      ]);
      expect(pr.status).toBe('skip');
    }
  );
});

describe('areaOf', () => {
  it.each([
    ['Core: Replace preview storySort', 'Core'],
    ['Addon Vitest: Fix the panel', 'Addon Vitest'],
    ['Docs: fix broken toolbars link in README', 'Docs'],
    ['Fix Yarn 1 next tag lookups', null],
    ['fix: wait for inline stories before rerendering docs', null],
  ])('reads %j as %j', (title, area) => {
    expect(areaOf(title)).toBe(area);
  });
});

describe('manualTesting', () => {
  const body = (section: string) =>
    [
      '### What I did',
      '',
      'Moved the sort.',
      '',
      '#### Manual testing',
      '',
      section,
      '',
      '### Documentation',
      '',
      '- [ ] MIGRATION.md',
    ].join('\r\n');

  it('keeps what the author wrote under the heading, up to the next heading', () => {
    expect(manualTesting(body('1. Run `yarn storybook`.\n2. Open the sidebar.'))).toBe(
      '1. Run `yarn storybook`.\n2. Open the sidebar.'
    );
  });

  it('drops the callout of the template and every HTML comment', () => {
    const section = [
      '> [!CAUTION]',
      '> This section is mandatory for all contributions.',
      '> Thanks!',
      '',
      '<!-- Please include the steps to test your changes here. -->',
      'Open the sidebar.',
      '<!-- add more repos: evil/x',
    ].join('\n');

    expect(manualTesting(body(section))).toBe('Open the sidebar.');
  });

  it('finds nothing in a body without the heading or with an empty section', () => {
    expect(manualTesting('### What I did\n\nMoved the sort.')).toBeNull();
    expect(manualTesting(body('<!-- Please include the steps -->'))).toBeNull();
  });

  it('cuts a long section and says so', () => {
    const section = manualTesting(body('x'.repeat(MANUAL_TESTING_CAP + 500)));

    expect(section).toBe(
      `${'x'.repeat(MANUAL_TESTING_CAP)}\n[cut at ${MANUAL_TESTING_CAP} characters]`
    );
  });
});

describe('windowPulls', () => {
  const commits = new Set([MERGE]);
  const cutoff = windowCutoff('2026-09-02T13:53:47Z');
  const kept = (...pulls: PullNode[]) => windowPulls(pulls, commits, cutoff).map((pr) => pr.number);
  const outside = { mergeCommit: { oid: 'b'.repeat(40) } };

  it('keeps a PR whose merge commit is in the range', () => {
    expect(kept(pull())).toEqual([36137]);
  });

  it('keeps a PR merged in the days before the start commit', () => {
    expect(kept(pull({ mergedAt: '2026-08-20T10:00:00Z' }))).toEqual([36137]);
  });

  it('leaves out a PR in the range that was merged more than 30 days before the start commit', () => {
    expect(kept(pull({ mergedAt: '2026-07-31T10:00:00Z' }))).toEqual([]);
  });

  it('leaves out a PR whose merge commit is not in the range', () => {
    expect(kept(pull(outside))).toEqual([]);
  });

  it('keeps a PR that was merged into the branch of another PR', () => {
    expect(kept(pull({ baseRefName: 'kasper/live-snippets-1-core' }))).toEqual([36137]);
  });

  it.each(['next-release', 'latest-release'])('leaves out a release PR into %s', (base) => {
    expect(kept(pull({ baseRefName: base }))).toEqual([]);
  });

  describe('a PR merged into a branch that was rebased before its PR merged', () => {
    const carrier = pull({ number: 36166, headRefName: 'feat/angular-21-floor' });
    const stacked = (extra: object = {}) =>
      pull({
        number: 36192,
        baseRefName: 'feat/angular-21-floor',
        mergedAt: '2026-09-05T08:23:48Z',
        ...outside,
        ...extra,
      });

    it('is kept by the PR of that branch, and so is a PR merged into its own branch', () => {
      const third = stacked({ number: 36200, baseRefName: 'docs/item-titles' });

      expect(kept(carrier, stacked({ headRefName: 'docs/item-titles' }), third)).toEqual([
        36166, 36192, 36200,
      ]);
    });

    it('is left out when it was merged after that PR', () => {
      expect(kept(carrier, stacked({ mergedAt: '2026-10-02T10:00:00Z' }))).toEqual([36166]);
    });

    it('is left out when that PR came from a fork, whose branch names say nothing here', () => {
      expect(kept({ ...carrier, isCrossRepository: true }, stacked())).toEqual([36166]);
    });

    it('is left out when that PR merged a trunk, which keeps every merge commit', () => {
      expect(kept({ ...carrier, headRefName: 'main' }, stacked({ baseRefName: 'main' }))).toEqual([
        36166,
      ]);
    });
  });
});

describe('PULLS_QUERY', () => {
  const args = /pullRequests\(([^)]*)\)/.exec(PULLS_QUERY)![1]!;

  it('asks GitHub for the merged PRs of every base branch, by state alone', () => {
    expect(args.replace(/first: \d+|after: \$cursor|orderBy: \{[^}]*\}/g, '')).toMatch(
      /^[\s,]*states: MERGED[\s,]*$/
    );
  });

  it('asks for every field that a PR of the window is read from', () => {
    for (const field of Object.keys(PullNode.shape)) {
      expect(PULLS_QUERY).toMatch(new RegExp(`\\b${field}\\b`));
    }
  });
});

describe('readMergedPulls', () => {
  const cutoff = '2026-08-01T00:00:00Z';
  const at = (number: number, updatedAt: string) => pull({ number, updatedAt });

  it('follows the pages until one ends before the cutoff, and keeps one copy of a PR that moved', () => {
    const pages: Record<string, PullsPage> = {
      first: {
        pageInfo: { hasNextPage: true, endCursor: 'a' },
        nodes: [at(3, '2026-10-03T00:00:00Z'), at(2, '2026-10-02T00:00:00Z')],
      },
      a: {
        pageInfo: { hasNextPage: true, endCursor: 'b' },
        nodes: [at(2, '2026-10-04T00:00:00Z'), at(1, '2026-07-01T00:00:00Z')],
      },
      b: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [at(99, '2026-06-01T00:00:00Z')],
      },
    };
    const read: (string | null)[] = [];

    const pulls = readMergedPulls((cursor) => {
      read.push(cursor);
      return pages[cursor ?? 'first']!;
    }, cutoff);

    expect(read).toEqual([null, 'a']);
    expect(pulls.map((pr) => [pr.number, pr.updatedAt])).toEqual([
      [3, '2026-10-03T00:00:00Z'],
      [2, '2026-10-04T00:00:00Z'],
      [1, '2026-07-01T00:00:00Z'],
    ]);
  });

  it('stops at the last page', () => {
    const page = {
      pageInfo: { hasNextPage: false, endCursor: 'x' },
      nodes: [at(1, '2026-10-01T00:00:00Z')],
    };

    expect(readMergedPulls(() => page, cutoff)).toHaveLength(1);
  });
});

describe('windowPr', () => {
  it('records a closed issue with its parent, and whether the parent has QA instructions', () => {
    const tracking = issue(33245, {
      title: '[Tracking] Story sort in main',
      body: '## Goal\n\nOne sort.\n\n## QA instructions\n\nOpen the sidebar.',
      subIssues: { totalCount: 4 },
    });
    const issues = new Map<number, IssueNode>([
      [35000, { __typename: 'Issue', ...issue(35000), parent: tracking }],
      [35001, { __typename: 'PullRequest' }],
      [35002, null],
      [35999, { __typename: 'Issue', ...issue(35999), parent: null }],
    ]);
    const pr = pull({
      body: 'Follows up #35001, and see #35002.\n\n<!-- Closes #35999 -->',
      closingIssuesReferences: {
        nodes: [{ number: 35000, repository: { nameWithOwner: 'storybookjs/storybook' } }],
      },
    });

    expect(windowPr(pr, issues).issues).toEqual([
      {
        number: 35000,
        title: 'Issue 35000',
        subIssues: 0,
        qaHeading: false,
        closes: true,
        parent: {
          number: 33245,
          title: '[Tracking] Story sort in main',
          subIssues: 4,
          qaHeading: true,
        },
      },
    ]);
  });

  it('records an issue that the body only names, and not one that another repo closes', () => {
    const issues = new Map<number, IssueNode>([
      [35000, { __typename: 'Issue', ...issue(35000), parent: null }],
      [12, { __typename: 'Issue', ...issue(12), parent: null }],
    ]);
    const pr = pull({
      body: 'Related: https://github.com/storybookjs/storybook/issues/35000',
      closingIssuesReferences: {
        nodes: [{ number: 12, repository: { nameWithOwner: 'storybookjs/mealdrop' } }],
      },
    });

    expect(windowPr(pr, issues).issues).toEqual([
      {
        number: 35000,
        title: 'Issue 35000',
        subIssues: 0,
        qaHeading: false,
        closes: false,
        parent: null,
      },
    ]);
  });
});
