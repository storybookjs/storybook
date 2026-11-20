import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { Actor, Discussion } from './github.ts';
import { manualDiscussionOf, manualDiscussionsOf, renderManualChecklist } from './manual-qa.ts';
import { parsePlan } from './qa-plan.ts';
import { Window } from './window.ts';

const HASH = '090a651bcbd5';
const PLAN = parsePlan(readFileSync(new URL('./plan.fixture.md', import.meta.url), 'utf8'));
const WINDOW = Window.parse(
  JSON.parse(readFileSync(new URL('./plan.fixture.window.json', import.meta.url), 'utf8'))
);

describe('renderManualChecklist', () => {
  it('lists one task for each manual check of the PR table and of the groups, and nothing else', () => {
    const tasks = renderManualChecklist(PLAN, WINDOW)
      .split('\n')
      .filter((line) => line.startsWith('- [ ] '));

    expect(tasks).toEqual([
      expect.stringContaining('- [ ] On Windows 11, make a React project with the webpack builder'),
      expect.stringContaining('- [ ] On Windows 11, in a Vite project whose main file sets'),
      expect.stringContaining('- [ ] In a story with a select control'),
      expect.stringContaining('- [ ] In a React project with the Storybook Links addon'),
    ]);
  });

  it('names the entry that tests a PR in part next to the PR of its manual check', () => {
    const checklist = renderManualChecklist(PLAN, WINDOW);

    expect(checklist).toContain(
      '  - [#35509](https://github.com/storybookjs/storybook/pull/35509) `UI: Fix controls expander and select chevron overlap in RTL`, the part that the plan entry `sidebar-tree` does not test\n'
    );
    expect(checklist).toContain(
      '  - [#36307](https://github.com/storybookjs/storybook/pull/36307) `Builder Vite: Static assets copy to handle Windows paths`\n'
    );
  });

  it('puts the checks of one reason under one heading, in the order the reasons first appear', () => {
    const outline = renderManualChecklist(PLAN, WINDOW)
      .split('\n')
      .filter((line) => /^(## |- \[ \] )/.test(line))
      .map((line) => line.slice(0, 40));

    expect(outline).toEqual([
      '## A fix that only Windows shows, and th',
      '- [ ] On Windows 11, make a React projec',
      '- [ ] On Windows 11, in a Vite project w',
      '## The sidebar entry shows the tree only',
      '- [ ] In a story with a select control, ',
      '## No repo of the catalog has the state ',
      '- [ ] In a React project with the Storyb',
    ]);
  });

  it('names the reason and every PR of a check with its title', () => {
    const plan = {
      ...PLAN,
      manual: [
        {
          check: 'On Windows 11, run `npx storybook dev`.',
          why: 'only Windows',
          prs: [37344, 36664],
        },
      ],
      none: [],
      groups: [],
    };

    expect(renderManualChecklist(plan, WINDOW)).toContain(
      [
        '## Only Windows',
        '',
        '- [ ] On Windows 11, run `npx storybook dev`.',
        '  - [#37344](https://github.com/storybookjs/storybook/pull/37344) `Core: Fix stories failing to load on Windows with the webpack builder`',
        '  - [#36664](https://github.com/storybookjs/storybook/pull/36664) `CI: Cancel workflow when format check fails`',
      ].join('\n')
    );
  });

  it('makes one item of a check that a row of manual QA and a group share', () => {
    const check = 'On Windows 11, run `npx storybook dev`.';
    const plan = {
      ...PLAN,
      manual: [{ check, why: 'only Windows', prs: [37344] }],
      none: [],
      groups: [
        {
          slug: 'windows',
          source: 'area Windows',
          decision: { manual: check, why: 'only Windows' },
          prs: [36664],
        },
      ],
    };

    expect(renderManualChecklist(plan, WINDOW)).toContain(
      [
        '- [ ] On Windows 11, run `npx storybook dev`.',
        '  - [#37344](https://github.com/storybookjs/storybook/pull/37344) `Core: Fix stories failing to load on Windows with the webpack builder`',
        '  - [#36664](https://github.com/storybookjs/storybook/pull/36664) `CI: Cancel workflow when format check fails`',
        '',
      ].join('\n')
    );
  });

  it('prints a title with a mention, a reference, and backticks as one code span', () => {
    const window = {
      ...WINDOW,
      prs: WINDOW.prs.map((pr) =>
        pr.number === 37344 ? { ...pr, title: 'Core: Thanks @someone for `x`, fixes #123' } : pr
      ),
    };

    expect(renderManualChecklist(PLAN, window)).toContain(
      '[#37344](https://github.com/storybookjs/storybook/pull/37344) ``Core: Thanks @someone for `x`, fixes #123``'
    );
  });
});

describe('manualDiscussionOf', () => {
  const COMMIT = '772120e5d39e696fc7bb196c482814fea193892b';
  const discussionOf = (plan = PLAN) =>
    manualDiscussionOf({
      plan,
      window: WINDOW,
      file: '11.0.md',
      hash: HASH,
      repo: 'storybookjs/storybook',
      commit: COMMIT,
    });
  const created = () => {
    const discussion = discussionOf();
    if (!('create' in discussion)) {
      throw new Error(`expected a discussion, got ${JSON.stringify(discussion)}`);
    }
    return discussion.create;
  };

  it('opens the body with the marker of the plan, then the checklist, then where it comes from', () => {
    expect(created().body).toBe(
      [
        `<!-- sb-qa-manual ${HASH} 11.0.md -->`,
        renderManualChecklist(PLAN, WINDOW),
        '---',
        '',
        `These checks come from the QA plan [\`11.0.md\`](https://github.com/storybookjs/storybook/blob/${COMMIT}/ecosystem-qa/plans/11.0.md).`,
        'The sweep tests the rest of that plan and reports in the discussion `[SB 11 QA] Dynamic sweep 11.0.md`.',
        '',
      ].join('\n')
    );
  });

  it('titles the discussion with the prefix of the tracking discussion', () => {
    expect(created().title).toBe('[SB 11 QA] Manual QA for Storybook 11.0 at 11.0.0-beta.3');
  });

  it('creates no discussion for a plan without manual checks', () => {
    const plan = {
      ...PLAN,
      manual: [],
      groups: PLAN.groups.filter(
        (group) => !('decision' in group && group.decision && 'manual' in group.decision)
      ),
    };

    expect(discussionOf(plan)).toEqual({
      skip: '11.0.md has no manual checks, so it gets no manual QA discussion.',
    });
  });

  it('refuses a checklist longer than GitHub takes as a body, naming both sizes', () => {
    const plan = { ...PLAN, manual: Array.from({ length: 1000 }, () => PLAN.manual[0]!) };

    expect(discussionOf(plan)).toEqual({
      refuse: expect.stringMatching(
        /^The manual QA discussion of 11\.0\.md would have a body of \d{6} characters, and GitHub takes at most 65536\.$/
      ),
    });
  });
});

describe('manualDiscussionsOf', () => {
  const body = `<!-- sb-qa-manual ${HASH} 11.0.md -->\n# Manual QA`;
  const discussion = (
    number: number,
    {
      author = { __typename: 'User', login: 'valentinpalkovic' } as Actor,
      association = 'MEMBER',
      text = body,
    } = {}
  ): Discussion => ({
    id: `D_${number}`,
    number,
    url: `https://github.com/storybookjs/storybook/discussions/${number}`,
    title: 'Manual QA',
    body: text,
    author,
    authorAssociation: association,
    editor: null,
  });

  it('finds the discussion of the hash that a member opened, oldest first', () => {
    const found = manualDiscussionsOf([discussion(37627), discussion(37000)], HASH);

    expect(found.map(({ number }) => number)).toEqual([37000, 37627]);
  });

  it('finds the discussion that the workflow opened', () => {
    const bot = discussion(37700, {
      author: { __typename: 'Bot', login: 'github-actions' },
      association: 'NONE',
    });

    expect(manualDiscussionsOf([bot], HASH)).toEqual([bot]);
  });

  it('ignores the marker in a discussion of a stranger, also one named like the workflow', () => {
    const strangers = [
      discussion(37701, { association: 'CONTRIBUTOR' }),
      discussion(37702, {
        author: { __typename: 'User', login: 'github-actions' },
        association: 'NONE',
      }),
    ];

    expect(manualDiscussionsOf(strangers, HASH)).toEqual([]);
  });

  it('ignores another hash and a marker below the first line, and reads a CRLF body', () => {
    const found = manualDiscussionsOf(
      [
        discussion(1, { text: body.replace(HASH, 'aaaaaaaaaaaa') }),
        discussion(2, { text: `Notes\n${body}` }),
        discussion(3, { text: body.replace('\n', '\r\n') }),
      ],
      HASH
    );

    expect(found.map(({ number }) => number)).toEqual([3]);
  });
});
