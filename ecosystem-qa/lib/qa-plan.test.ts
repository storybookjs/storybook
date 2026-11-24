import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadEntries } from './catalog.ts';
import {
  type CheckContext,
  checkPlanText,
  draftOfPlan,
  ENTRIES_PER_RUN,
  parsePlan,
  PlanDraft,
  planFromWindow,
  planRuns,
  readStep,
  renderLedger,
  renderPlan,
  renderPlanChecks,
} from './qa-plan.ts';
import { Window, type WindowPr } from './window.ts';

const FIXTURE = readFileSync(new URL('./plan.fixture.md', import.meta.url), 'utf8');

const pr = (number: number) =>
  `[#${number}](https://github.com/storybookjs/storybook/pull/${number})`;
const COMMIT = '998b471a4ad78c7c23426038ef0c4a5261fc41cf';
const WINDOWS_CHECK =
  'On Windows 11, make a React project with the webpack builder with `npx create-storybook@11.0.0-beta.3 --type react --builder webpack5`, run `npx storybook dev`, and open `http://localhost:6006`: every story renders and none shows `Cannot find module`. Then run `npx storybook build` and open the static build: the stories render there too.';
const WINDOWS_WHY = 'a fix that only Windows shows, and the sweep runs on Linux';
const GROUP_CHECK =
  "On Windows 11, in a Vite project whose main file sets `staticDirs: ['../public']`, run `npx storybook build`: every file of `public` is in `storybook-static`.";
const LINKS_CHECK =
  "In a React project with the Storybook Links addon, render a link whose `href` is `hrefToSync('Example/Button', 'Primary')` in a story, and click it: it opens that story.";
const STATE_WHY = 'no repo of the catalog has the state it acts on';
const RTL_CHECK =
  'In a story with a select control, set the page direction to right-to-left and open the controls panel: the chevron of the select does not overlap its text.';
const RTL_WHY =
  'the sidebar entry shows the tree only, and no repo of the catalog has a select control in a right-to-left story';
const PROBE =
  'a story file src/AnimationProbe.stories.tsx with one story Fade In whose box fades in with a CSS animation of two seconds';
const UI_DECISION = `\`sidebar-tree\`; manual for the rest: ${RTL_CHECK} Why: ${RTL_WHY}`;

const replaced = (text: string, from: string, to: string) => {
  expect(text).toContain(from);
  return text.replace(from, to);
};

const lineOf = (text: string, needle: string) =>
  text.split('\n').findIndex((line) => line.includes(needle)) + 1;

const CATALOG = loadEntries();

const problemsOf = (text: string, context: Partial<CheckContext> = {}) =>
  checkPlanText(text, { catalog: CATALOG, ...context }).problems;

const windowPr = (pr: Partial<WindowPr> & Pick<WindowPr, 'number' | 'title'>): WindowPr => ({
  area: null,
  status: 'needed',
  labels: [],
  manualTesting: null,
  issues: [],
  ...pr,
});

const windowOf = (prs: WindowPr[]): Window => ({
  from: 'v10.6.0',
  fromSha: 'a77777356be2aeaff89d7a2b25254db7b2318392',
  to: 'v11.0.0-beta.3',
  toSha: 'e0ecb3ec6ba3648e9e5d2cf74002adec6aefe561',
  prs,
});

const skipPr = (number: number, title: string, area: string) =>
  windowPr({ number, title, area, status: 'skip', labels: ['bug', 'qa:skip'] });

const WINDOW = Window.parse(
  JSON.parse(readFileSync(new URL('./plan.fixture.window.json', import.meta.url), 'utf8'))
);

// An edit of an entry changes its row in the overview table too, which render derives from it.
const rendered = (text: string) => {
  try {
    return renderPlan(parsePlan(text));
  } catch {
    return text;
  }
};
const edited = (from: string, to: string) => rendered(replaced(FIXTURE, from, to));

describe('the fixture plan', () => {
  it('is in its rendered form and passes every rule', () => {
    expect(renderPlan(parsePlan(FIXTURE))).toBe(FIXTURE);
    expect(problemsOf(FIXTURE)).toEqual([]);
  });

  it('reads the PRs that a step starts with, and passes every rule when no step names one', () => {
    const plan = parsePlan(FIXTURE);
    const unnamed = edited('- Step: #33422, #35509: Start', '- Step: Start');

    expect(plan.entries.find(({ slug }) => slug === 'sidebar-tree')?.steps).toEqual([
      '#33422, #35509: Start the dev server, open `http://localhost:6006`, and take a screenshot of the expanded sidebar.',
    ]);
    expect(problemsOf(unnamed)).toEqual([]);
  });

  it.each([
    ['#36436: Stop Vitest.', [36436], 'Stop Vitest.'],
    ['#36421, #36436: Stop Vitest.', [36421, 36436], 'Stop Vitest.'],
    ['Stop Vitest.', [], 'Stop Vitest.'],
    ['Stop the process of #36436: Vitest.', [], 'Stop the process of #36436: Vitest.'],
    ['#36436 Stop Vitest.', [], '#36436 Stop Vitest.'],
    ['#036436: Stop Vitest.', [], '#036436: Stop Vitest.'],
  ])('reads the step %j as the PRs %j and the text %j', (step, prs, text) => {
    expect(readStep(step)).toEqual({ prs, text });
  });

  it('matches the window it was rendered from', () => {
    expect(problemsOf(FIXTURE, { window: WINDOW })).toEqual([]);
  });

  it('splits the entries of mealdrop in batch 1 into parts of Entries per run', () => {
    expect(planRuns(parsePlan(FIXTURE), 1)).toEqual([
      { repo: 'mealdrop', part: 1, entries: ['story-sort-in-main', 'preview-animations'] },
      { repo: 'mealdrop', part: 2, entries: ['csf-factory-namespaces'] },
      { repo: 'mantine', part: 1, entries: ['csf-factory-namespaces'] },
    ]);
  });

  it('gives the agent the reason for the repo, every step and the expected outcome of an entry', () => {
    const plan = parsePlan(FIXTURE);
    const entries = plan.entries.filter(({ slug }) => slug === 'csf-factory-namespaces');

    expect(renderPlanChecks(entries, 'mantine')).toMatchInlineSnapshot(`
      "- \`plan.csf-factory-namespaces\` (plan): Legacy addon namespaces work in CSF factories. Why this repo: a large set of stories with addon parameters.
        1. Run \`npx storybook doctor\` and build Storybook.
        Expected: The build ends with exit 0 and the doctor output names no addon namespace."
    `);
  });

  it('reads a probe and a group that an entry tests in part, as render writes them', () => {
    const plan = parsePlan(FIXTURE);

    expect(plan.entries.find(({ slug }) => slug === 'animation-probe')?.probe).toBe(PROBE);
    expect(plan.entries.filter((entry) => entry.probe !== undefined)).toHaveLength(1);
    expect(plan.groups.find((group) => group.slug === 'ui')).toMatchObject({
      decision: { entries: ['sidebar-tree'], manual: RTL_CHECK, why: RTL_WHY },
    });
    expect(FIXTURE).toContain(
      "| Probe: `animation-probe` A new story's animation pauses in the preview | 3 |"
    );
  });

  it('tells the agent what a probe adds, after the upgrade, and where the copy goes', () => {
    const plan = parsePlan(FIXTURE);
    const entries = plan.entries.filter(({ slug }) => slug === 'animation-probe');

    expect(renderPlanChecks(entries, 'mealdrop')).toMatchInlineSnapshot(`
      "- \`plan.animation-probe\` (plan): A new story's animation pauses in the preview. Why this repo: owned, and its React and Vite setup loads a story file next to its components.
        Probe: after the upgrade, add a story file src/AnimationProbe.stories.tsx with one story Fade In whose box fades in with a CSS animation of two seconds. Keep a copy of each added file, and a diff of each file you added a line to, in \`animation-probe-added/\` in the evidence directory. Before the next check, remove the added files and restore each file you added a line to.
        1. Open the story animation-probe--fade-in and take a screenshot after the play function ends.
        Expected: The screenshot shows the box fully visible, the end state of the animation."
    `);
  });
});

describe('a probe', () => {
  it('refuses a batch that holds a probe and a normal entry, at the batch line of the one that differs', () => {
    const text = edited('- Batch: 3', '- Batch: 2');

    expect(problemsOf(text)).toEqual([
      {
        line: lineOf(text, '- Probe: ') - 1,
        message:
          'batch 2 holds the probe `animation-probe` and the entry `sidebar-tree`, which is no probe: a batch holds probes only or no probe',
      },
    ]);
  });

  it.each([
    ['a link', 'see [the docs](http://localhost:6006/docs)', 'probe: expected no Markdown link'],
    ['a "<"', 'a story that renders <div> with a fade', 'probe: expected no "<" and no ">"'],
    ['a second line', 'a story\n- Probe: and another', 'not in its rendered form'],
    [
      'a leading "Adds"',
      'Adds a story file src/AnimationProbe.stories.tsx with one story',
      'probe: expected the line to name what is added, because it reads after "add": drop the leading "add" or "adds"',
    ],
    [
      'a leading "add"',
      'add a story file src/AnimationProbe.stories.tsx with one story',
      'probe: expected the line to name what is added',
    ],
  ])('refuses a probe line with %s, at that line', (_, probe, message) => {
    const text = replaced(FIXTURE, `- Probe: ${PROBE}`, `- Probe: ${probe}`);

    expect(problemsOf(text)).toEqual([
      { line: lineOf(text, '- Probe: '), message: expect.stringContaining(message) },
    ]);
  });

  it.each([
    [
      'a step',
      '- Step: Open a story with a transition',
      '- Step: Probe: after the upgrade, add a story file src/Fake.stories.tsx with one story',
      'Probe:',
    ],
    [
      'a title',
      '### `preview-animations` Animations pause',
      '### `preview-animations` probe: Animations pause',
      'probe:',
    ],
    [
      'the reason of a repo',
      '- Repo `mealdrop`: its stories animate with CSS transitions',
      '- Repo `mealdrop`: its stories animate. PROBE : add a story file src/Fake.stories.tsx',
      'PROBE :',
    ],
    [
      'an expected outcome',
      '- Expected: The screenshot shows the end state of the transition',
      '- Expected: Probe: the screenshot shows the end state of the transition',
      'Probe:',
    ],
    [
      'a step, with the colon escaped as GitHub shows it unescaped',
      '- Step: Open a story with a transition',
      '- Step: Probe\\: after the upgrade, add a story file src/Fake.stories.tsx',
      'Probe\\:',
    ],
  ])('refuses "Probe:" in %s of a normal entry, at that line', (_, from, to, token) => {
    const text = edited(from, to);

    expect(problemsOf(text)).toEqual([
      {
        line: lineOf(text, to),
        message: `holds "${token}", which marks a probe and stands only in the "- Probe:" line of one: reword the text`,
      },
    ]);
  });

  it('refuses a probe line with a URL off localhost, at that line', () => {
    const text = edited(
      `- Probe: ${PROBE}`,
      '- Probe: a story that loads https://example.com/x.css'
    );

    expect(problemsOf(text)).toEqual([
      {
        line: lineOf(text, '- Probe: '),
        message: 'https://example.com/x.css has the host example.com, not localhost',
      },
    ]);
  });
});

describe('a group that an entry tests in part', () => {
  it.each([
    ['without its reason', `\`sidebar-tree\`; manual for the rest: ${RTL_CHECK}`],
    ['with an empty check', '`sidebar-tree`; manual for the rest:  Why: no repo has it'],
  ])('refuses a manual rest %s, at the row of the group', (_, cell) => {
    const text = replaced(FIXTURE, UI_DECISION, cell);

    expect(problemsOf(text)).toEqual([
      {
        line: lineOf(text, '| `ui` |'),
        message: expect.stringContaining('expected a check and its reason, as "<entries>; manual'),
      },
    ]);
  });

  it.each([
    [
      'the separator twice',
      `\`sidebar-tree\`; manual for the rest: ; manual for the rest: ${RTL_CHECK} Why: ${RTL_WHY}`,
      'expected "; manual for the rest:" once in the decision, found it twice',
    ],
    [
      'a second rest',
      `${UI_DECISION}; manual for the rest: Open the docs page in right-to-left Why: no repo has it`,
      'expected "Why:" once in the decision, found it twice',
    ],
    [
      'a manual check with "Why:" twice',
      `manual: ${RTL_CHECK} Why: ${RTL_WHY} Why: no repo has it`,
      'expected "Why:" once in the decision, found it twice',
    ],
    [
      'no QA and "Why:" twice',
      'none: no effect Why: a project Why: can show',
      'expected "Why:" once in the decision, found it twice',
    ],
  ])('refuses a decision with %s, at the row of the group', (_, cell, message) => {
    const text = replaced(FIXTURE, UI_DECISION, cell);

    expect(problemsOf(text)).toEqual([{ line: lineOf(text, '| `ui` |'), message }]);
  });

  it('refuses a draft that gives a PR outside a group entries and a manual check in one decision', () => {
    expect(
      PlanDraft.safeParse({
        decisions: { '37344': { entries: ['sidebar-tree'], manual: RTL_CHECK, why: RTL_WHY } },
      }).success
    ).toBe(false);
  });
});

describe('a file that is not in its rendered form', () => {
  it('fails at the first line that differs', () => {
    const text = replaced(FIXTURE, `| a change of this`, `|  a change of this`);

    expect(problemsOf(text)).toEqual([
      { line: lineOf(text, 'a change of this'), message: expect.stringContaining('rendered form') },
    ]);
  });

  it('fails at a row of the overview that differs from its entry', () => {
    const text = replaced(FIXTURE, '| `mealdrop`, `mantine` | 1 |', '| `mantine` | 1 |');

    expect(problemsOf(text)).toEqual([
      {
        line: lineOf(text, '| `mantine` | 1 |'),
        message: expect.stringContaining('| `mealdrop`, `mantine` | 1 |'),
      },
    ]);
  });

  it('fails at an overview row whose entry is gone', () => {
    const entry = FIXTURE.indexOf('### `sidebar-tree`');
    const text = `${FIXTURE.slice(0, entry).trimEnd()}\n`;

    expect(problemsOf(text)).toEqual([
      { line: lineOf(text, '| `sidebar-tree`'), message: expect.stringContaining('rendered form') },
    ]);
  });

  it('fails at a line the parser skipped', () => {
    const text = replaced(FIXTURE, '## Discovered repos', 'A note.\n\n## Discovered repos');

    expect(problemsOf(text)).toEqual([
      { line: lineOf(text, 'A note.'), message: 'expected "## Discovered repos"' },
    ]);
  });

  it('names a line after the last entry as one that belongs to no entry', () => {
    const text = `${FIXTURE}A note.\n`;

    expect(problemsOf(text)).toEqual([
      { line: lineOf(text, 'A note.'), message: 'unexpected line after the last entry' },
    ]);
  });

  it('fails without its final newline', () => {
    expect(problemsOf(FIXTURE.trimEnd())).toEqual([
      {
        line: FIXTURE.split('\n').length,
        message: expect.stringContaining('the end of the file after a newline'),
      },
    ]);
  });
});

describe('checkPlanText', () => {
  it.each([
    [
      'a slug with upper case',
      '### `preview-animations`',
      '### `Preview-animations`',
      '### `Preview',
      'lower case letters',
    ],
    [
      'a slug used twice',
      '### `preview-animations`',
      '### `story-sort-in-main`',
      '### `story-sort-in-main` Animations',
      'is used twice',
    ],
    [
      'a group used twice',
      '| `ui` | area UI |',
      '| `tooling` | area UI |',
      '| `tooling` | area Tooling',
      'the group `tooling` is used twice',
    ],
    [
      'a version off the line',
      '| Version | 11.0.0-beta.3 |',
      '| Version | 11.1.0-beta.3 |',
      '| Version |',
      'is not on line 11.0',
    ],
    [
      'a discovered row on a short commit',
      `/tree/${COMMIT})`,
      '/tree/998b471)',
      '| `primer-react` |',
      'full commit SHA',
    ],
    [
      'a discovered repo without the link to its commit',
      `[primer/react](https://github.com/primer/react/tree/${COMMIT})`,
      'primer/react',
      '| `primer-react` |',
      'expected a repo linked to its commit',
    ],
    [
      'a discovered repo that links another repo',
      `[primer/react](https://github.com/primer/react/tree/`,
      `[primer/react](https://github.com/evil/react/tree/`,
      '| `primer-react` |',
      'expected a repo linked to its commit',
    ],
    [
      'a last push that is not in the form pin.ts prints',
      '| 2026-11-16T14:42:00Z |',
      '| 2026-11-16 |',
      '| `primer-react` |',
      'expected a time',
    ],
    [
      'a discovered row with an unknown package manager',
      '| npm | packages/react |',
      '| deno | packages/react |',
      '| `primer-react` |',
      'packageManager',
    ],
    [
      'an entry PR that has a row of PRs that need no QA too',
      `- PRs: ${pr(31900)}`,
      `- PRs: ${pr(31900)}, ${pr(36664)}`,
      `| ${pr(36664)} |`,
      '#36664 is tested by `preview-animations`, so it has no row in "PRs that need no QA"',
    ],
    [
      'a PR in two rows of manual QA',
      `| ${pr(37344)} |`,
      `| ${pr(37344)} |\n| ${GROUP_CHECK} | ${WINDOWS_WHY} | ${pr(37344)} |`,
      `| ${GROUP_CHECK} |`,
      '#37344 has a row already',
    ],
    ['a PR without its link', `| ${pr(36664)} |`, '| #36664 |', '| #36664 |', 'expected a PR like'],
    [
      'a PR that links another PR',
      `- PRs: ${pr(36137)}`,
      '- PRs: [#36137](https://github.com/storybookjs/storybook/pull/36138)',
      '- PRs: [#36137]',
      'expected a PR like',
    ],
    [
      'a row without a decision',
      `| ${WINDOWS_CHECK} | ${WINDOWS_WHY} |`,
      '|  |  |',
      pr(37344),
      '#37344 has no decision',
    ],
    [
      'a manual check without its reason',
      `| ${WINDOWS_WHY} | ${pr(37344)}`,
      `|  | ${pr(37344)}`,
      pr(37344),
      'expected why the sweep cannot test it next to the check',
    ],
    [
      'a reason of manual QA without its check',
      `| ${WINDOWS_CHECK} |`,
      '|  |',
      pr(37344),
      'expected the check a person does next to why the sweep cannot test it',
    ],
    [
      'a row of no QA without a reason',
      "| a change of this repository's CI, no project can see it |",
      '|  |',
      pr(36664),
      'expected the reason why these PRs need no QA',
    ],
    [
      'a PR with a row of manual QA and a row of no QA',
      `| ${pr(35618)} |`,
      `| ${pr(35618)} |\n| CI only | ${pr(37344)} |`,
      '| CI only |',
      '#37344 has a row already',
    ],
    [
      'a check with two rows',
      `| ${pr(37344)} |`,
      `| ${pr(37344)} |\n| ${WINDOWS_CHECK} | other | ${pr(36664)} |`,
      `| other | ${pr(36664)} |`,
      'the check "On Windows 11, make a React project',
    ],
    [
      'a group decision that still says skip',
      '| none: no effect that a project can show |',
      '| skip: no effect that a project can show |',
      '| `tooling` |',
      '"skip:" is no decision: choose "manual: <check> Why: <why the sweep cannot test it>" for a check a person does, or "none: <reason>" for a change that needs no QA',
    ],
    [
      'a group that needs no QA without a reason',
      '| none: no effect that a project can show |',
      '| none: |',
      '| `tooling` |',
      'expected the reason why no QA is needed after "none:"',
    ],
    [
      'a manual group without its reason',
      ` Why: ${WINDOWS_WHY} |`,
      ' |',
      '| `windows` |',
      'expected a check and its reason, as "manual: <check> Why: <why the sweep cannot test it>"',
    ],
    [
      'a manual group without its check',
      `| manual: ${GROUP_CHECK} Why:`,
      '| manual: Why:',
      '| `windows` |',
      'expected a check and its reason',
    ],
    [
      'a manual check with a URL of another host',
      'open `http://localhost:6006`: every story',
      'open `https://example.com`: every story',
      `| ${pr(37344)} |`,
      'https://example.com has the host example.com, not localhost',
    ],
    [
      'a reason of manual QA with a URL of another host',
      `| ${WINDOWS_WHY} | ${pr(37344)}`,
      `| ${WINDOWS_WHY}, see https://example.com/ci | ${pr(37344)}`,
      `| ${pr(37344)} |`,
      'https://example.com/ci has the host example.com, not localhost',
    ],
    [
      'a reason of no QA with a URL of another host',
      "a change of this repository's CI, no project can see it",
      "a change of this repository's CI, see https://example.com/run",
      pr(36664),
      'https://example.com/run has the host example.com, not localhost',
    ],
    [
      'a group decision with a URL of another host',
      'none: no effect that a project can show',
      'none: see https://example.com/x',
      '| `tooling` |',
      'https://example.com/x has the host example.com, not localhost',
    ],
    [
      'the manual check of a group with a URL of another host',
      'click it: it opens that story.',
      'open https://example.com/x: it opens that story.',
      '| `addon-links` |',
      'https://example.com/x has the host example.com, not localhost',
    ],
    [
      'a manual check that holds " Why: ", which would split its cell in a group',
      'open the static build: the stories',
      'open the static build Why: the stories',
      `| ${pr(37344)} |`,
      'check: expected no "Why:"',
    ],
    [
      'a group that lists a PR twice',
      ` | ${pr(34799)} |`,
      ` | ${pr(34799)}, ${pr(34799)} |`,
      '| `tooling` |',
      'prs: a PR is listed twice',
    ],
    [
      'a manual check that mentions a person',
      'open the static build: the stories',
      'ask @someone: the stories',
      `| ${pr(37344)} |`,
      'a manual check names no person, PR, or issue, in a code span either',
    ],
    [
      'a manual check that points to a PR',
      'open the static build: the stories',
      'follow the steps of #37344: the stories',
      `| ${pr(37344)} |`,
      'a manual check names no person, PR, or issue, in a code span either',
    ],
    [
      'the reason of a manual group that points to an issue',
      `Why: ${WINDOWS_WHY} |`,
      `Why: ${WINDOWS_WHY}, see #36000 |`,
      '| `windows` |',
      'a manual check names no person, PR, or issue, in a code span either',
    ],
    [
      'a reason with two rows',
      `| ${pr(35618)} |`,
      `| ${pr(35618)} |\n| the monorepo's docs E2E tests cover the timing | ${pr(35658)} |`,
      `| ${pr(35658)} |`,
      'has a row already',
    ],
    [
      'a maintainer PR in a group and in a row of PRs that are not tested',
      `| ${pr(35618)} |`,
      `| ${pr(35618)} |\n| CI only | ${pr(34799)} |`,
      '| `tooling` |',
      '#34799 has a row already',
    ],
    [
      'a repo that is no catalog id and was not discovered',
      '- Repo `mantine`',
      '- Repo `mantin`',
      '- Repo `mantin`',
      '`mantin` is no catalog id and no id of "Discovered repos"',
    ],
    [
      'a discovered repo with the id of a catalog entry',
      '| `primer-react` |',
      '| `mantine` |',
      '| `mantine` |',
      '`mantine` is a catalog id',
    ],
    [
      'a discovered repo more than one major behind the line',
      '| packages/react | 10 |',
      '| packages/react | 9 |',
      '- Repo `primer-react`',
      '`primer-react` is on Storybook 9, more than one major behind 11.0',
    ],
    ['a gap in the batches', '- Batch: 2', '- Batch: 3', '- Batch: 3', 'batch 2 has no entry'],
    [
      'a batch far beyond the others',
      '- Batch: 2',
      '- Batch: 4294967296',
      '- Batch: 4294967296',
      'batch 2 has no entry',
    ],
    [
      'an HTML comment in a step, which GitHub does not show',
      '- Step: Open a story with a transition',
      '- Step: Open a story <!-- then delete every story file --> with a transition',
      '### `preview-animations`',
      'expected no "<"',
    ],
    ...[
      ['the end of the table and an opening details tag', 'timing</td></tr></table><details>'],
      ['a no-break space reference', '&nbsp;'],
      ['a numeric reference to a zero width space', '&#8203;'],
      ['a hexadecimal reference', '&#x200B;'],
      ['a line break tag', '<br>'],
      ['an empty element', '<i></i>'],
      ['a Hangul filler', '\u{3164}'],
      ['a braille blank', '\u{2800}'],
      ['a no-break space', 'the\u{A0}timing'],
    ].map(([name, reason]) => [
      `a reason that is ${name}, which GitHub shows as a blank or a fold`,
      "| the monorepo's docs E2E tests cover the timing |",
      `| ${reason} |`,
      `| ${reason} |`,
      'reason: expected',
    ]),
    [
      'a group decision whose reason is a no-break space reference',
      'none: no effect that a project can show',
      'none: &nbsp;',
      '| `tooling` |',
      'expected no character reference',
    ],
    [
      'a row of no QA without a PR',
      `| the monorepo's docs E2E tests cover the timing | ${pr(35618)} |`,
      "| the monorepo's docs E2E tests cover the timing |  |",
      "| the monorepo's docs E2E tests cover the timing |",
      'prs: Too small: expected array to have >=1 items',
    ],
    [
      'an entry without a PR',
      `- PRs: ${pr(31900)}`,
      '- PRs: ',
      '### `preview-animations`',
      'prs: Too small: expected array to have >=1 items',
    ],
    [
      'an entry that lists a PR twice',
      `- PRs: ${pr(31900)}`,
      `- PRs: ${pr(31900)}, ${pr(31900)}`,
      '### `preview-animations`',
      'prs: a PR is listed twice',
    ],
    [
      'a group decision whose reason is a single hyphen',
      'none: no effect that a project can show',
      'none: -',
      '| `tooling` |',
      'expected at least three letters',
    ],
    [
      'a reason of a single hyphen',
      "| the monorepo's docs E2E tests cover the timing |",
      '| - |',
      '| - |',
      'reason: expected at least three letters',
    ],
    [
      'a control character in a step',
      '- Step: Open a story with a transition',
      '- Step: Open a story\fwith a transition',
      '### `preview-animations`',
      'expected printable ASCII only',
    ],
    [
      'a line separator in a reason',
      "| a change of this repository's CI, no project",
      "| a change of this repository's CI,\u{2028}no project",
      "| a change of this repository's CI,",
      'expected one line of text',
    ],
    [
      'a line separator in the source of a group',
      '| area UI |',
      '| area\u{2028}UI |',
      '| `ui` |',
      'expected one line of text',
    ],
    ...[
      ['a byte order mark', '\u{FEFF}'],
      ['a soft hyphen', '\u{AD}'],
      ['a zero width space', '\u{200B}'],
      ['a right-to-left override', '\u{202E}'],
      ['a Unicode tag character', '\u{E0041}'],
    ].map(([name, character]) => [
      `${name} in a step, which GitHub does not show`,
      '- Step: Open a story with a transition',
      `- Step: Open a story with${character} a transition`,
      '### `preview-animations`',
      'expected printable ASCII only',
    ]),
    [
      'a Storybook directory with a backslash',
      '| npm | packages/react |',
      '| npm | packages\\react |',
      '| `primer-react` |',
      'expected a relative path inside the repository',
    ],
    [
      'a Storybook directory that climbs out of the repository',
      '| npm | packages/react |',
      '| npm | packages/../../outside |',
      '| `primer-react` |',
      'expected a relative path inside the repository',
    ],
    [
      'an absolute Storybook directory',
      '| npm | packages/react |',
      '| npm | /etc |',
      '| `primer-react` |',
      'expected a relative path inside the repository',
    ],
    ['a batch 0', '- Batch: 1', '- Batch: 0', '### `story-sort-in-main`', 'batch: Too small'],
    [
      'a maintainer PR without a group',
      `| \`tooling\` | area Tooling, no project | none: no effect that a project can show | ${pr(34799)} |`,
      `|  |  |  | ${pr(34799)} |`,
      `| ${pr(34799)} |`,
      '#34799 is in no group',
    ],
    [
      'a second row of maintainer PRs without a group',
      `| \`tooling\` | area Tooling, no project | none: no effect that a project can show | ${pr(34799)} |`,
      `|  |  |  | ${pr(34799)} |\n|  |  |  | ${pr(35509)} |`,
      `|  |  |  | ${pr(35509)} |`,
      'a second row of PRs without a group',
    ],
    [
      'a group that names no entry of the plan',
      '| `ui` | area UI | `sidebar-tree`;',
      '| `ui` | area UI | `sidebar`;',
      '| `ui` | area UI |',
      'the group `ui` names `sidebar`, which is no entry of this plan',
    ],
    [
      'an entry PR whose group needs no QA',
      `| \`ui\` | area UI | ${UI_DECISION} |`,
      '| `ui` | area UI | none: covered elsewhere |',
      `- PRs: ${pr(33422)}`,
      '#35509 is listed here, but its group `ui` does not name `sidebar-tree`',
    ],
    [
      'a group without a decision',
      '| `tooling` | area Tooling, no project | none: no effect that a project can show |',
      '| `tooling` | area Tooling, no project |  |',
      '| `tooling` | area',
      'has no decision',
    ],
    [
      'a link to Linear',
      'a deep sidebar tree that no catalog entry has',
      'see https://linear.app/example/issue/EX-1',
      '| `primer-react` |',
      'Linear, Notion, or Slack',
    ],
    [
      'a step with a URL other than localhost',
      'fetch `http://localhost:6006/index.json`',
      'fetch `https://example.com/index.json`',
      'fetch `https://example.com',
      'https://example.com/index.json has the host example.com, not localhost',
    ],
    [
      'an expected outcome with a URL of another host',
      'the baseline, and the upgrade',
      'the copy on https://www.example.com/sb/index.json, and the upgrade',
      'the copy on https://www.example.com',
      'has the host www.example.com, not localhost',
    ],
    [
      'a slug too long for its check id',
      '### `preview-animations`',
      `### \`preview-animations-${'x'.repeat(57)}\``,
      '### `preview-animations-',
      'short enough for the check id',
    ],
    [
      'a step that names a PR of another entry',
      '- Step: #33422, #35509: Start',
      '- Step: #33422, #36137: Start',
      '- Step: #33422, #36137: Start',
      'the step names #36137, which is no PR of `sidebar-tree`',
    ],
    [
      'a step that names no PR in an entry whose other step does',
      '- Step: #33422, #35509: Start the dev server',
      '- Step: #33422, #35509: Start the dev server, open `http://localhost:6006`.\n- Step: Take a screenshot',
      '- Step: Take a screenshot',
      'another step of `sidebar-tree` names its PRs, so this one does too',
    ],
  ])('refuses %s with its line', (_, from, to, lineNeedle, message) => {
    const text = edited(from, to);
    expect(problemsOf(text)).toContainEqual({
      line: lineOf(text, lineNeedle),
      message: expect.stringContaining(message),
    });
  });

  const testedInPart = edited(`- PRs: ${pr(31900)}`, `- PRs: ${pr(31900)}, ${pr(37344)}`);

  it('accepts a PR that an entry tests in part and a row of manual QA holds for the rest', () => {
    expect(problemsOf(testedInPart, { window: WINDOW })).toEqual([]);
  });

  it('refuses an entry PR in the row of PRs without a decision', () => {
    const text = rendered(
      replaced(testedInPart, `| ${WINDOWS_CHECK} | ${WINDOWS_WHY} |`, '|  |  |')
    );

    expect(problemsOf(text)).toContainEqual({
      line: lineOf(text, `|  |  | ${pr(37344)} |`),
      message:
        '#37344 is tested by `preview-animations`, so it has no row in "PRs that need manual QA"',
    });
  });

  const withStep = (step: string) =>
    replaced(FIXTURE, '- Step: Read which automigrations the upgrade ran', `- Step: ${step}`);

  it.each([
    [
      'one slash after the scheme',
      'fetch `http:/example.com/x`',
      'http:/example.com/x',
      'example.com',
    ],
    [
      'backslashes after the scheme',
      'open `http:\\\\example.com\\x`',
      'http:\\\\example.com\\x',
      'example.com',
    ],
    [
      'no slash after the scheme',
      'fetch `http:example.com/x`',
      'http:example.com/x',
      'example.com',
    ],
    ['a web socket with one slash', 'open `ws:/example.com/x`', 'ws:/example.com/x', 'example.com'],
    ['upper case', 'fetch `HTTPS://EXAMPLE.COM/x`', 'HTTPS://EXAMPLE.COM/x', 'example.com'],
    [
      'localhost as user',
      'fetch `http://localhost@example.com/x`',
      'http://localhost@example.com/x',
      'example.com',
    ],
    [
      'a backslash before the user',
      'fetch `http://localhost\\@example.com/x`',
      'http://localhost\\@example.com/x',
      'example.com',
    ],
    [
      'a semicolon after localhost',
      'fetch `http://localhost;.example.com/x`',
      'http://localhost;.example.com/x',
      'localhost;.example.com',
    ],
    [
      'a comma after localhost',
      'fetch `http://localhost,.example.com/x`',
      'http://localhost,.example.com/x',
      'localhost,.example.com',
    ],
    [
      'an apostrophe after localhost',
      "fetch http://localhost'.example.com/x",
      "http://localhost'.example.com/x",
      "localhost'.example.com",
    ],
    [
      'a parenthesis after localhost',
      'fetch http://localhost).example.com/x',
      'http://localhost).example.com/x',
      'localhost).example.com',
    ],
    [
      'a backtick after localhost',
      'fetch `http://localhost`.example.com/x',
      'http://localhost`.example.com/x',
      'localhost`.example.com',
    ],
    [
      'a percent-encoded dot',
      'fetch `http://localhost%2eexample.com/x`',
      'http://localhost%2eexample.com/x',
      'localhost.example.com',
    ],
    ['three slashes', 'fetch `http:///example.com/x`', 'http:///example.com/x', 'example.com'],
    [
      'a scheme after another word',
      'fetch `see:http://example.com/x`',
      'http://example.com/x',
      'example.com',
    ],
    [
      'a scheme glued to a short option',
      'run `curl -xhttp://proxy.example.com:3128 http://localhost:6006/index.json`',
      'xhttp://proxy.example.com:3128',
      'proxy.example.com',
    ],
    [
      'a scheme after a digit',
      'run `curl $1http://example.com/x`',
      'http://example.com/x',
      'example.com',
    ],
    [
      'a scheme after a plus',
      'run `curl +http://example.com/x`',
      'http://example.com/x',
      'example.com',
    ],
    [
      'a scheme after a number and a full stop',
      'fetch the index on port 6006.http://example.com/x',
      'http://example.com/x',
      'example.com',
    ],
    [
      'a file URL with a host',
      'open `file://example.com/x`',
      'file://example.com/x',
      'example.com',
    ],
    ['every interface', 'open `http://0.0.0.0:6006`', 'http://0.0.0.0:6006', '0.0.0.0'],
  ])('refuses a URL with %s in a step', (_, step, url, host) => {
    const text = withStep(step);

    expect(problemsOf(text)).toEqual([
      { line: lineOf(text, step), message: `${url} has the host ${host}, not localhost` },
    ]);
  });

  it.each([
    [
      'a bracket after localhost',
      'fetch `http://localhost].example.com/x`',
      'http://localhost].example.com/x',
    ],
    [
      'a port that is no number',
      'fetch `http://localhost:6006.example.com/x`',
      'http://localhost:6006.example.com/x',
    ],
  ])('refuses a URL with %s, which no parser reads', (_, step, url) => {
    const text = withStep(step);

    expect(problemsOf(text)).toEqual([
      { line: lineOf(text, step), message: `${url} is a URL that the URL parser cannot read` },
    ]);
  });

  it.each([
    [
      'localhost before prose punctuation',
      'Open (http://localhost:6006), "http://localhost:6006"; then http://localhost:6006.',
    ],
    ['the loopback addresses', 'Open `http://127.0.0.1:6006/` and `http://[::1]:6006/`.'],
    [
      'a second port and a web socket',
      'Open `http://localhost:6007/iframe.html?id=a--b` and `ws://localhost:6006/storybook-server-channel`.',
    ],
    ['localhost in upper case', 'Open `HTTP://LOCALHOST:6006/index.json`.'],
    ['a file URL without a host', 'Read `file:///tmp/x.log`.'],
    [
      'file names and paths',
      'Read `README.md`, `ui.kit/src/Button.tsx`, `package.json:12`, `tsconfig.app.json`, `.env.dev`, and `node_modules/lodash.debounce/index.js`.',
    ],
    [
      'property paths',
      'Read `console.info`, `parameters.docs.page`, `import.meta.env.DEV`, `items.at(-1)`, and `args.to`.',
    ],
    [
      'names and versions',
      'Check `socket.io`, `ASP.NET`, and monday.com on Chrome 120.0.0.0 with `storybook@11.0.0-beta.3`.',
    ],
    ['a script and a time', 'Run `yarn test:watch` at 10:30. Note: it prints a warning.'],
    [
      'a host without a scheme, which the reviewer reads for',
      'Start with `--host 0.0.0.0` and fetch `example.com/x` and `//example.com/x`.',
    ],
  ])('accepts %s in a step', (_, step) => {
    expect(problemsOf(withStep(step))).toEqual([]);
  });

  it.each([
    ['the title of an entry', '### `preview-animations` Animations'],
    ['the reason of a repo', '- Repo `mealdrop`: its stories animate'],
  ])('refuses a URL in %s, which the runner prints into the prompt', (_, line) => {
    const text = edited(line, `${line} see https://example.com`);

    expect(problemsOf(text)).toEqual([
      {
        line: lineOf(text, `${line} see https://example.com`),
        message: 'https://example.com has the host example.com, not localhost',
      },
    ]);
  });

  it.each([
    ['Notion', 'https://www.notion.so/example/Plan-0123456789abcdef'],
    ['Notion', 'https://www.notion.com/example/Plan-0123456789abcdef'],
    ['Notion', 'https://example.notion.site/Plan'],
    ['Slack', 'https://example.slack.com/archives/C0/p1'],
  ])('refuses a link to %s anywhere, also in the title of an entry', (_, link) => {
    const heading = '### `preview-animations` Animations';
    const text = edited(`${heading} pause only in the preview`, `${heading} ${link}`);

    expect(problemsOf(text)).toContainEqual({
      line: lineOf(text, `${heading} ${link}`),
      message: 'links to Linear, Notion, or Slack, which the plan must not',
    });
  });

  it('refuses a discovered id used twice at its second row', () => {
    const row = FIXTURE.split('\n').find((line) => line.startsWith('| `primer-react` |'))!;
    const text = replaced(FIXTURE, row, `${row}\n${row}`);

    expect(problemsOf(text)).toEqual([
      { line: lineOf(text, row) + 1, message: 'the id `primer-react` is used twice' },
    ]);
  });

  it('refuses a catalog entry more than one major behind the line', () => {
    const catalog = CATALOG.map((entry) =>
      entry.id === 'mantine' ? { ...entry, tags: { ...entry.tags!, major: 9 } } : entry
    );

    expect(problemsOf(FIXTURE, { catalog })).toEqual([
      {
        line: lineOf(FIXTURE, '- Repo `mantine`'),
        message: '`mantine` is on Storybook 9, more than one major behind 11.0',
      },
    ]);
  });

  it('names a PR of the window that is in no place, and a place of a PR that is not in the window', () => {
    const window = {
      ...WINDOW,
      prs: [...WINDOW.prs, windowPr({ number: 40000, title: 'Core: Something new', area: 'Core' })],
    };
    const text = replaced(FIXTURE, pr(36664), pr(36665));
    const heading = '## PRs that need manual QA';
    const nowhere = 'in no entry and no row of "PRs that need manual QA" or "PRs that need no QA"';

    expect(problemsOf(text, { window })).toEqual([
      { line: lineOf(text, heading), message: `#36664 of the window is ${nowhere}` },
      { line: lineOf(text, heading), message: `#40000 of the window is ${nowhere}` },
      { line: lineOf(text, pr(36665)), message: '#36665 is not in the window' },
    ]);
  });

  it.each([
    [
      'an entry PR that the window does not hold',
      `- PRs: ${pr(31900)}`,
      `- PRs: ${pr(31900)}, ${pr(40000)}`,
      `- PRs: ${pr(31900)}`,
      '#40000 is not in the window',
    ],
    [
      'an entry PR that was verified by hand',
      `- PRs: ${pr(31900)}`,
      `- PRs: ${pr(31900)}, ${pr(36153)}`,
      `- PRs: ${pr(31900)}`,
      '#36153 is verified by hand in the window, so the plan does not decide it',
    ],
    [
      'a PR marked qa:skip that is in no group',
      ` | ${pr(34799)} |`,
      ' |  |',
      '## Groups of PRs marked qa:skip',
      '#34799 of the window is in no row of "Groups of PRs marked qa:skip"',
    ],
    [
      'a PR marked qa:skip whose group row is gone',
      FIXTURE.split('\n').find((line) => line.startsWith('| `addon-links` |'))!,
      '',
      '## Groups of PRs marked qa:skip',
      '#36189 of the window is in no row of "Groups of PRs marked qa:skip"',
    ],
    [
      'a PR marked qa:skip in a row of PRs that need no QA',
      `| ${pr(36664)} |`,
      `| ${pr(36664)}, ${pr(35509)} |`,
      `| ${pr(36664)}, ${pr(35509)} |`,
      '#35509 is marked qa:skip, so it belongs in a group',
    ],
    [
      'a PR that needs QA in a group',
      ` | ${pr(34799)} |`,
      ` | ${pr(34799)}, ${pr(36664)} |`,
      ` | ${pr(34799)}, ${pr(36664)} |`,
      '#36664 is not marked qa:skip, so it belongs in no group',
    ],
  ])('refuses against the window %s', (_, from, to, lineNeedle, message) => {
    const text = edited(from, to);

    expect(problemsOf(text, { window: WINDOW })).toContainEqual({
      line: lineOf(text, lineNeedle),
      message,
    });
  });

  it.each([[['qa:skip']], [['maintenance', 'qa:skip']], [['dependencies', 'ci', 'qa:skip']]])(
    'refuses a PR marked qa:skip with the labels %j that is in no group',
    (labels) => {
      const skipped = windowPr({
        number: 40000,
        title: 'Build: Bump a tool',
        status: 'skip',
        labels,
      });
      const window = { ...WINDOW, prs: [...WINDOW.prs, skipped] };

      expect(problemsOf(FIXTURE, { window })).toEqual([
        {
          line: lineOf(FIXTURE, '## Groups of PRs marked qa:skip'),
          message: '#40000 of the window is in no row of "Groups of PRs marked qa:skip"',
        },
      ]);
    }
  );

  it('takes a PR marked qa:needed and one without a QA label in one row', () => {
    const text = edited(`| ${pr(35618)} |`, `| ${pr(35618)}, ${pr(36664)} |`).replace(
      `\n| a change of this repository's CI, no project can see it | ${pr(36664)} |`,
      ''
    );

    expect(problemsOf(text, { window: WINDOW })).toEqual([]);
  });

  const WRAPPERS: [string, (form: string) => string][] = [
    ['as it is', (form) => form],
    ['in a code span', (form) => `\`${form}\``],
    ['between escaped backticks', (form) => `\\\`${form}\\\``],
    ['after one backtick and before two', (form) => `\`${form}\`\``],
  ];
  const wrapped = (forms: string[][]) =>
    forms.flatMap(([name, form, ...rest]) =>
      WRAPPERS.map(([where, wrap]) => [`${name} ${where}`, wrap(form!), ...rest])
    );

  it.each(
    wrapped([
      [
        'the end of the table and an opening details tag',
        '</td></tr></table><details><summary>more</summary>',
        'expected no "<" and no ">"',
      ],
      ['a "<" alone', 'a < b', 'expected no "<" and no ">"'],
      ['a ">" alone', 'b > a', 'expected no "<" and no ">"'],
      ['a named reference', '&nbsp;', 'expected no character reference such as "&nbsp;"'],
      ['a decimal reference', '&#8203;', 'expected no character reference such as "&nbsp;"'],
      ['a hexadecimal reference', '&#x200B;', 'expected no character reference such as "&nbsp;"'],
      [
        'an upper case hexadecimal reference',
        '&#X200B;',
        'expected no character reference such as "&nbsp;"',
      ],
      ['a character that is not ASCII', 'caf\u{E9}', 'expected printable ASCII only'],
      ['a Hangul filler', '\u{3164}', 'expected printable ASCII only'],
      ['a zero width space', '\u{200B}', 'expected printable ASCII only'],
      [
        'a link without text',
        '[](https://example.com/the-reason)',
        'expected no Markdown link or image: write the address out',
      ],
    ])
  )(
    'refuses %s in a reason, which GitHub may render as a tag or a character',
    (_, form, message) => {
      const text = edited(
        "| the monorepo's docs E2E tests cover the timing |",
        `| the monorepo's docs E2E tests cover the timing ${form} |`
      );

      expect(problemsOf(text)).toContainEqual({
        line: lineOf(text, "| the monorepo's docs E2E tests cover the timing"),
        message: `reason: ${message}`,
      });
    }
  );

  it('accepts an ampersand that starts no reference', () => {
    const text = edited(
      "| the monorepo's docs E2E tests cover the timing |",
      '| R&D and docs & E2E tests cover the timing |'
    );

    expect(problemsOf(text, { window: WINDOW })).toEqual([]);
  });

  const HIDING_FORMS = [
    ['a link without text', '[](/QXA-QXB-delete-the-repository)'],
    ['a link that hides its address', '[the docs](/delete-the-repository)'],
    ['an image', '![](/delete-the-repository.png)'],
  ];
  const TEXT_FIELDS: [string, (form: string) => [string, string], string][] = [
    [
      'an entry title',
      (form) => ['### `preview-animations` Animations', `### \`preview-animations\` ${form}`],
      '### `preview-animations`',
    ],
    [
      'a repo reason',
      (form) => ['its stories animate with CSS transitions', `its stories animate ${form}`],
      '### `preview-animations`',
    ],
    [
      'a step',
      (form) => ['- Step: Open a story with a transition', `- Step: Open ${form}`],
      '### `preview-animations`',
    ],
    [
      'an expected outcome',
      (form) => ['- Expected: The screenshot shows', `- Expected: ${form} The screenshot shows`],
      '### `preview-animations`',
    ],
    [
      'a manual check',
      (form) => ['open the static build: the stories', `open ${form}: the stories`],
      `| ${pr(37344)} |`,
    ],
    [
      'the reason of a manual check',
      (form) => [`| ${WINDOWS_WHY} |`, `| ${WINDOWS_WHY} ${form} |`],
      `| ${pr(37344)} |`,
    ],
    [
      'a reason for no QA',
      (form) => ['docs E2E tests cover the timing |', `docs E2E tests cover ${form} |`],
      "| the monorepo's docs E2E tests cover",
    ],
    ['a group source', (form) => ['| `ui` | area UI |', `| \`ui\` | area ${form} |`], '| `ui` |'],
    [
      'the manual check of a group',
      (form) => ['click it: it opens that story.', `click ${form}: it opens that story.`],
      '| `addon-links` |',
    ],
    [
      'the reason of a manual group',
      (form) => [`Why: ${WINDOWS_WHY} |`, `Why: ${WINDOWS_WHY} ${form} |`],
      '| `windows` |',
    ],
    [
      'the reason of a group without QA',
      (form) => ['none: no effect that a project can show', `none: no effect ${form}`],
      '| `tooling` |',
    ],
    [
      'the reason of a discovered repo',
      (form) => ['a deep sidebar tree that no catalog entry has', `a deep sidebar tree ${form}`],
      '| `primer-react` |',
    ],
  ];

  it.each(
    TEXT_FIELDS.flatMap(([field, edit, lineNeedle]) =>
      HIDING_FORMS.map(([name, form]) => [`${name} in ${field}`, ...edit(form!), lineNeedle])
    )
  )(
    'refuses %s, which GitHub shows without the text the agent reads',
    (_, from, to, lineNeedle) => {
      const text = edited(from!, to!);

      expect(problemsOf(text)).toContainEqual({
        line: lineOf(text, lineNeedle!),
        message: expect.stringContaining('expected no Markdown link or image'),
      });
    }
  );

  const ISSUE_LINK = '[#36128](https://github.com/storybookjs/storybook/issues/36128)';

  it.each([
    ['an issue', ISSUE_LINK],
    ['a PR', pr(36128)],
  ])('accepts a group source that links %s as the plan links a PR', (_, link) => {
    expect(
      problemsOf(edited('| `ui` | area UI |', `| \`ui\` | area UI, ${link} |`), { window: WINDOW })
    ).toEqual([]);
  });

  it.each([
    [
      'a link whose text and address name other numbers',
      '[#36128](https://github.com/storybookjs/storybook/issues/36129)',
    ],
    ['a link to another repository', '[#36128](https://github.com/storybookjs/other/issues/36128)'],
    ['the issue link as an image', `!${ISSUE_LINK}`],
    ['a link inside the issue link', `[${ISSUE_LINK}](/delete-the-repository)`],
  ])('refuses a group source with %s', (_, link) => {
    const text = edited('| `ui` | area UI |', `| \`ui\` | area UI, ${link} |`);

    expect(problemsOf(text)).toContainEqual({
      line: lineOf(text, '| `ui` |'),
      message: expect.stringContaining('expected no Markdown link or image'),
    });
  });

  const REFERENCE_FORMS = [
    ['a mention', '@ghost'],
    ['a team mention', '@storybook/react'],
    ['a PR reference', '#36664'],
    ['a GH reference', 'GH-36664'],
    ['a GH reference in lower case', 'gh-36664'],
    ['a mention in underscore emphasis', '_@ghost_'],
    ['a mention in star emphasis', '*@ghost*'],
    ['a mention in parentheses', '(@ghost)'],
    ['a mention in strikethrough', '~@ghost~'],
    ['an at sign before a hyphen', '@-ghost'],
    ['a path to a PR', 'storybookjs/storybook/pull/36664'],
    ['an address of a PR', 'github.com/storybookjs/storybook/pull/36664'],
    ['a path to an issue', 'storybookjs/storybook/issues/36664'],
  ];

  it.each(
    wrapped(REFERENCE_FORMS).flatMap(([name, form]) => [
      [
        `${name} in a manual check`,
        'open the static build: the stories',
        `open ${form}: the stories`,
        `| ${pr(37344)} |`,
      ],
      [
        `${name} in the reason of a manual check`,
        `| ${WINDOWS_WHY} | ${pr(37344)}`,
        `| ${WINDOWS_WHY} ${form} | ${pr(37344)}`,
        `| ${pr(37344)} |`,
      ],
      [
        `${name} in the manual check of a group`,
        'click it: it opens that story.',
        `click ${form}: it opens that story.`,
        '| `addon-links` |',
      ],
      [
        `${name} in the reason of a manual group`,
        `Why: ${WINDOWS_WHY} |`,
        `Why: ${WINDOWS_WHY} ${form} |`,
        '| `windows` |',
      ],
    ])
  )('refuses %s, which an issue may link', (_, from, to, lineNeedle) => {
    const text = edited(from!, to!);

    expect(problemsOf(text)).toContainEqual({
      line: lineOf(text, lineNeedle!),
      message: expect.stringContaining('a manual check names no person, PR, or issue'),
    });
  });

  it('refuses a mention at the start of a manual check', () => {
    const text = edited('| On Windows 11, make a React', '| @ghost on Windows 11, make a React');

    expect(problemsOf(text)).toContainEqual({
      line: lineOf(text, `| ${pr(37344)} |`),
      message: expect.stringContaining('a manual check names no person, PR, or issue'),
    });
  });

  it.each([
    ['an address', 'mail qa@example.org: the stories'],
    ['a package at a version', 'run `npx storybook@11.0.0-beta.3 build`: the stories'],
  ])('accepts %s in a manual check, which an issue does not link', (_, to) => {
    expect(problemsOf(edited('open the static build: the stories', to))).toEqual([]);
  });

  it('refuses a character reference in the text of a link, in the source of a group', () => {
    const text = edited('| `ui` | area UI |', '| `ui` | [&nbsp;](https://example.org/) |');

    expect(problemsOf(text)).toContainEqual({
      line: lineOf(text, '| `ui` |'),
      message: expect.stringContaining('no character reference'),
    });
  });

  it('names the tags of the window when the plan was written for other ones', () => {
    const window = { ...WINDOW, from: 'v10.5.0' };

    expect(problemsOf(FIXTURE, { window })).toEqual([
      {
        line: lineOf(FIXTURE, '| Window start |'),
        message: 'the window has `v10.5.0` a77777356be2aeaff89d7a2b25254db7b2318392',
      },
    ]);
  });
});

describe('draftOfPlan', () => {
  const plan = { ...parsePlan(FIXTURE), entriesPerRun: ENTRIES_PER_RUN };
  const undecided = structuredClone(plan);
  undecided.manual = [{ check: null, why: null, prs: [37344] }];
  const [ui, tooling, ...rest] = undecided.groups;
  undecided.groups = [ui!, { ...tooling!, prs: [] }, ...rest, { slug: null, prs: tooling!.prs }];
  const testedInPart = structuredClone(plan);
  testedInPart.entries[1]!.prs.push(37344);

  it.each([
    ['a finished plan', plan],
    ['a plan with an undecided row and an ungrouped PR', undecided],
    ['a plan with a PR that an entry tests in part and a row of manual QA holds', testedInPart],
  ])('gives for %s the JSON draft from which render writes it again', (_, it) => {
    const draft = PlanDraft.parse(JSON.parse(JSON.stringify(draftOfPlan(it))));

    expect(renderPlan(planFromWindow(WINDOW, draft))).toBe(renderPlan(it));
  });

  it('decides a PR for every entry that lists it, and leaves a grouped PR to its group', () => {
    expect(draftOfPlan(plan).decisions).toEqual({
      '31900': { entries: ['preview-animations', 'animation-probe'] },
      '33422': { entries: ['sidebar-tree'] },
      '35618': { none: "the monorepo's docs E2E tests cover the timing" },
      '35658': { entries: ['csf-factory-namespaces'] },
      '36137': { entries: ['story-sort-in-main'] },
      '36664': { none: "a change of this repository's CI, no project can see it" },
      '37344': { manual: WINDOWS_CHECK, why: WINDOWS_WHY },
    });
  });
});

describe('planFromWindow', () => {
  const needed = windowPr({ number: 1, title: 'Core: Keep a title', area: 'Core' });
  const grouped = skipPr(2, 'UI: Rebuild the sidebar', 'UI');
  const entry = {
    slug: 'sidebar',
    title: 'The sidebar',
    prs: [1],
    batch: 1,
    repos: [{ id: 'mealdrop', reason: 'a sidebar' }],
    steps: ['Open the sidebar.'],
    expected: 'It opens.',
  };

  it('keeps a pipe and a backtick of a reason through render and parse', () => {
    const draft = PlanDraft.parse({ decisions: { '1': { none: 'only `a | b` shows it' } } });
    const text = renderPlan(planFromWindow(windowOf([needed]), draft));

    expect(parsePlan(text).none[0]!.reason).toBe('only `a | b` shows it');
    expect(problemsOf(text)).toEqual([]);
  });

  it.each([
    ['a PR', { decisions: { '1': { skip: 'only CI can see it' } } }, ['decisions', '1']],
    [
      'a group',
      { groups: [{ slug: 'ci', source: 'area CI', decision: { skip: 'only CI' } }] },
      ['groups', 0, 'decision'],
    ],
  ])('refuses a draft that still skips %s', (_, draft, path) => {
    const result = PlanDraft.safeParse(draft);

    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path,
        message:
          '"skip" is no decision: choose "manual" with the check a person does, or "none" with the reason no QA is needed',
      }),
    ]);
  });

  it('puts PRs with one manual check into one row, apart from the PRs without a decision', () => {
    const other = windowPr({ number: 3, title: 'CLI: Other', area: 'CLI' });
    const undecided = windowPr({ number: 4, title: 'CLI: Third', area: 'CLI' });
    const manual = { manual: 'On Windows 11, run `npx storybook dev`.', why: 'only Windows' };
    const draft = PlanDraft.parse({ decisions: { '1': manual, '3': manual } });

    expect(planFromWindow(windowOf([needed, other, undecided]), draft).manual).toEqual([
      { check: manual.manual, why: manual.why, prs: [1, 3] },
      { check: null, why: null, prs: [4] },
    ]);
  });

  it('keeps one check with two reasons in two rows, so neither reason is lost', () => {
    const other = windowPr({ number: 3, title: 'CLI: Other', area: 'CLI' });
    const check = 'On Windows 11, run `npx storybook dev`.';
    const draft = PlanDraft.parse({
      decisions: {
        '1': { manual: check, why: 'only Windows' },
        '3': { manual: check, why: 'a race' },
      },
    });

    expect(planFromWindow(windowOf([needed, other]), draft).manual).toEqual([
      { check, why: 'only Windows', prs: [1] },
      { check, why: 'a race', prs: [3] },
    ]);
  });

  it('leaves every PR of a skeleton undecided, so the check names each of them', () => {
    const text = renderPlan(planFromWindow(windowOf([needed, grouped]), PlanDraft.parse({})));

    expect(problemsOf(text).map((problem) => problem.message)).toEqual([
      '#1 has no decision',
      '#2 is in no group',
    ]);
  });

  it('puts PRs with one reason into one row', () => {
    const other = windowPr({ number: 3, title: 'CI: Other', area: 'CI' });
    const draft = PlanDraft.parse({
      decisions: { '1': { none: 'only CI can see it' }, '3': { none: 'only CI can see it' } },
    });

    expect(planFromWindow(windowOf([needed, other]), draft).none).toEqual([
      { reason: 'only CI can see it', prs: [1, 3] },
    ]);
  });

  it('takes entries, decisions and groups from the draft', () => {
    const window = windowOf([needed, grouped]);
    const draft = PlanDraft.parse({
      entries: [{ ...entry, prs: [1, 2] }],
      decisions: { '1': { entries: ['sidebar'] } },
      groups: [{ slug: 'ui', source: 'area UI', decision: { entries: ['sidebar'] } }],
      groupOf: { '2': 'ui' },
    });
    const text = renderPlan(planFromWindow(window, draft));

    expect(problemsOf(text, { window })).toEqual([]);
  });

  it.each([
    [
      'decides a PR the window holds in another role',
      { decisions: { '2': { none: 'no effect' } } },
      'decides #2',
    ],
    [
      'groups a PR that is not marked qa:skip',
      {
        groups: [{ slug: 'x', source: 'area X', decision: { none: 'no effect' } }],
        groupOf: { '1': 'x', '2': 'x' },
      },
      'The draft groups #1, which is not marked qa:skip in the window.',
    ],
    ['groups a PR into a group it does not have', { groupOf: { '2': 'x' } }, 'groups #2 into `x`'],
    [
      'decides a PR for an entry that does not list it',
      { entries: [{ ...entry, prs: [3] }], decisions: { '1': { entries: ['sidebar'] } } },
      'decides #1 for `sidebar`, and the entries that list it are none',
    ],
    [
      'gives no QA to a PR that an entry lists',
      { entries: [entry], decisions: { '1': { none: 'no effect' } } },
      'gives #1 no QA, and the entries `sidebar` list it',
    ],
  ])('refuses a draft that %s', (_, draft, message) => {
    expect(() => planFromWindow(windowOf([needed, grouped]), PlanDraft.parse(draft))).toThrow(
      message
    );
  });

  it('puts a PR that an entry tests in part into the entry and into its row of manual QA', () => {
    const manual = { manual: 'On Windows 11, open the sidebar.', why: 'only Windows' };
    const window = windowOf([needed]);
    const plan = planFromWindow(
      window,
      PlanDraft.parse({ entries: [entry], decisions: { '1': manual } })
    );

    expect(plan.entries[0]!.prs).toEqual([1]);
    expect(plan.manual).toEqual([{ check: manual.manual, why: manual.why, prs: [1] }]);
    expect(problemsOf(renderPlan(plan), { window })).toEqual([]);
  });

  it('puts a PR whose issue belongs to a tracking issue with QA steps into its group', () => {
    const tracked = {
      ...grouped,
      issues: [
        {
          number: 30,
          title: 'A bug',
          subIssues: 0,
          qaHeading: false,
          closes: true,
          parent: { number: 31202, title: 'Tracking', subIssues: 4, qaHeading: true },
        },
      ],
    };
    const plan = planFromWindow(windowOf([tracked]), PlanDraft.parse({}));

    expect(plan.groups).toEqual([
      {
        slug: 'issue-31202',
        source: '[#31202](https://github.com/storybookjs/storybook/issues/31202)',
        decision: null,
        prs: [2],
      },
    ]);
  });
});

describe('renderLedger', () => {
  it('names a PR of the window that the plan does not decide as nowhere', () => {
    const window = {
      ...WINDOW,
      prs: [...WINDOW.prs, skipPr(40000, 'Core: Something new', 'Core')],
    };

    expect(renderLedger(parsePlan(FIXTURE), window)).toContain(
      '| 40000 | qa:skip | Core | Core: Something new | nowhere |'
    );
  });

  it('names for every PR of the window where it is in the plan, or why it is not', () => {
    const rows = renderLedger(parsePlan(FIXTURE), WINDOW)
      .split('\n')
      .filter((line) => /^\| \d/.test(line))
      .map((line) => line.slice(2, -2).split(' | '));

    expect(rows.map(([number, , , , where]) => [Number(number), where])).toEqual([
      [31900, 'tested by `preview-animations`; tested by `animation-probe`'],
      [33422, 'tested by `sidebar-tree`'],
      [34799, 'group `tooling`: none: no effect that a project can show'],
      [35509, `tested by \`sidebar-tree\`; group \`ui\`: ${UI_DECISION}`],
      [35618, "no QA: the monorepo's docs E2E tests cover the timing"],
      [35658, 'tested by `csf-factory-namespaces`'],
      [36137, 'tested by `story-sort-in-main`'],
      [36153, 'verified by hand'],
      [36189, `group \`addon-links\`: manual: ${LINKS_CHECK} Why: ${STATE_WHY}`],
      [36307, `group \`windows\`: manual: ${GROUP_CHECK} Why: ${WINDOWS_WHY}`],
      [36664, "no QA: a change of this repository's CI, no project can see it"],
      [37344, `manual QA: ${WINDOWS_CHECK}`],
    ]);
  });
});
