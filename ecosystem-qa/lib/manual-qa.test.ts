import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { renderManualChecklist } from './manual-qa.ts';
import { parsePlan } from './qa-plan.ts';
import { Window } from './window.ts';

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
        '- [ ] On Windows 11, run `npx storybook dev`.',
        '  - Why the sweep cannot test it: only Windows',
        '  - [#37344](https://github.com/storybookjs/storybook/pull/37344) `Core: Fix stories failing to load on Windows with the webpack builder`',
        '  - [#36664](https://github.com/storybookjs/storybook/pull/36664) `CI: Cancel workflow when format check fails`',
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
