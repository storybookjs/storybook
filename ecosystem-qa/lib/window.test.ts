import { describe, expect, it } from 'vitest';

import {
  areaOf,
  inWindow,
  type IssueNode,
  MANUAL_TESTING_CAP,
  manualTesting,
  needsGroup,
  PullNode,
  qaStatus,
  windowCutoff,
  windowPr,
} from './window.ts';

const MERGE = 'a'.repeat(40);

const pull = (extra: object = {}): PullNode =>
  PullNode.parse({
    number: 36137,
    title: 'Core: Replace preview storySort with chained storySorts in main',
    body: '',
    updatedAt: '2026-10-02T10:00:00Z',
    mergedAt: '2026-10-01T10:00:00Z',
    authorAssociation: 'MEMBER',
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
});

describe('needsGroup', () => {
  const prOf = (authorAssociation: string) => windowPr(pull({ authorAssociation }), new Map());

  it('selects a qa:skip PR with a product label that a maintainer wrote', () => {
    expect(needsGroup(prOf('MEMBER'))).toBe(true);
  });

  it('leaves out the same PR from a contributor', () => {
    expect(needsGroup(prOf('CONTRIBUTOR'))).toBe(false);
  });

  it('leaves out a maintainer PR without a product label', () => {
    const pr = windowPr(
      pull({ labels: { nodes: [{ name: 'qa:skip' }, { name: 'build' }] } }),
      new Map()
    );

    expect(needsGroup(pr)).toBe(false);
  });
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

describe('inWindow', () => {
  const commits = new Set([MERGE]);
  const cutoff = windowCutoff('2026-09-02T13:53:47Z');

  it('keeps a PR whose merge commit is in the range', () => {
    expect(inWindow(pull(), commits, cutoff)).toBe(true);
  });

  it('keeps a PR merged in the days before the start commit', () => {
    expect(inWindow(pull({ mergedAt: '2026-08-20T10:00:00Z' }), commits, cutoff)).toBe(true);
  });

  it('leaves out a PR in the range that was merged in 2021', () => {
    expect(inWindow(pull({ mergedAt: '2021-06-01T10:00:00Z' }), commits, cutoff)).toBe(false);
  });

  it('leaves out a PR whose merge commit is not in the range', () => {
    expect(inWindow(pull({ mergeCommit: { oid: 'b'.repeat(40) } }), commits, cutoff)).toBe(false);
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
