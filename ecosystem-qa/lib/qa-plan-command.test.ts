import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { draftOfPlan, parsePlan, type PlanDraft, planFromWindow, renderPlan } from './qa-plan.ts';
import { Window } from './window.ts';

const COMMAND = new URL('../qa-plan.ts', import.meta.url).pathname;
const FIXTURE = readFileSync(new URL('./plan.fixture.md', import.meta.url));

// Node hands a child a socket for its input, which Linux cannot open as /dev/stdin, so cat turns
// it into a pipe.
const qaPlan = (args: string[], input?: Buffer) =>
  spawnSync('sh', ['-c', 'cat | "$0" "$@"', process.execPath, COMMAND, ...args], {
    input: input ?? Buffer.alloc(0),
    encoding: 'utf8',
  });

const withByte = (byte: number) => {
  const at = FIXTURE.indexOf('sets `storySort`') + 'sets `story'.length;
  return Buffer.concat([FIXTURE.subarray(0, at), Buffer.of(byte), FIXTURE.subarray(at)]);
};

describe('qa-plan.ts check', () => {
  it.each([0xfe, 0xff])('refuses the byte %d in a code span, which is no ASCII', (byte) => {
    const { status, stderr } = qaPlan(['check', '/dev/stdin'], withByte(byte));

    expect(status).toBe(1);
    expect(stderr).toContain('expected printable ASCII only');
  });

  it('counts the entries with more than one PR whose steps name their PRs', () => {
    const { status, stdout } = qaPlan(['check', '/dev/stdin'], FIXTURE);

    expect(status).toBe(0);
    expect(stdout).toContain(
      '\nEntries with more than one PR whose every step names the PRs it tests: 1 of 1.\n'
    );
  });

  it('refuses a second file instead of checking only the first', () => {
    const { status, stderr } = qaPlan(['check', 'a.md', 'b.md']);

    expect(status).toBe(1);
    expect(stderr).toContain('check takes one file, and was given 2.');
  });
});

describe('qa-plan.ts draft', () => {
  const WINDOW = new URL('./plan.fixture.window.json', import.meta.url).pathname;
  const rendered = FIXTURE.toString('utf8').replace(
    '| Entries per run | 2 |',
    '| Entries per run | 4 |'
  );
  const draft = (plan: string) =>
    qaPlan(['draft', '/dev/stdin', '--window', WINDOW, '--out', '/dev/null'], Buffer.from(plan));

  it('writes the draft of a plan that render writes from the window', () => {
    expect(draft(rendered).status).toBe(0);
  });

  it('refuses a plan in which a row was deleted by hand, whose draft would bring it back', () => {
    const row = rendered
      .split('\n')
      .find((line) => line.startsWith("| a change of this repository's CI"))!;
    const { status, stderr } = draft(rendered.replace(`${row}\n`, ''));

    expect(status).toBe(1);
    expect(stderr).toContain(`/dev/stdin is not the plan that render writes from ${WINDOW}.`);
  });
});

describe('qa-plan.ts manual', () => {
  const PLAN = new URL('./plan.fixture.md', import.meta.url).pathname;
  const WINDOW = new URL('./plan.fixture.window.json', import.meta.url).pathname;

  it('prints the checklist of a plan that passes check with its window', () => {
    const { status, stdout } = qaPlan(['manual', '/dev/stdin', '--window', WINDOW], FIXTURE);

    expect(status).toBe(0);
    expect(stdout).toContain('- [ ] On Windows 11');
  });

  it('prints no checklist for a plan that fails check', () => {
    const broken = FIXTURE.toString('utf8').replace(
      "| the monorepo's docs E2E tests cover the timing |",
      '| - |'
    );
    const { status, stdout, stderr } = qaPlan(
      ['manual', '/dev/stdin', '--window', WINDOW],
      Buffer.from(broken)
    );

    expect(status).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain('expected at least three letters');
  });

  it('prints no checklist for a plan that leaves a PR of the window without a place', () => {
    const window = JSON.parse(readFileSync(WINDOW, 'utf8'));
    window.prs.push({ ...window.prs[0], number: 40000 });
    const { status, stdout, stderr } = qaPlan(
      ['manual', PLAN, '--window', '/dev/stdin'],
      Buffer.from(JSON.stringify(window))
    );

    expect(status).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain('#40000 of the window is');
  });
});

describe('qa-plan.ts diff', () => {
  const PLAN = new URL('./plan.fixture.md', import.meta.url).pathname;
  const WINDOW = new URL('./plan.fixture.window.json', import.meta.url).pathname;
  const window = Window.parse(JSON.parse(readFileSync(WINDOW, 'utf8')));
  const rendered = (change: (draft: PlanDraft) => void) => {
    const draft = draftOfPlan(parsePlan(FIXTURE.toString('utf8')));
    change(draft);
    return Buffer.from(renderPlan(planFromWindow(window, draft)));
  };
  const diff = (plans: [string, string], input: Buffer, moved?: string) =>
    qaPlan(['diff', ...plans, '--window', WINDOW, ...(moved ? ['--moved', moved] : [])], input);

  // #36137 leaves the tests for a manual check, so its entry goes, and #37344 needs no QA any more.
  const untested = rendered((draft) => {
    draft.entries = draft.entries.filter((entry) => entry.slug !== 'story-sort-in-main');
    draft.decisions['36137'] = {
      manual: 'In a project whose preview file sets a story sort, run the upgrade.',
      why: 'no repo of the catalog has the state it acts on',
    };
    draft.decisions['37344'] = { none: "a change of this repository's CI, no project can see it" };
  });

  it('prints that nothing differs for the plan that render writes from the same draft', () => {
    const { status, stdout } = diff(
      [PLAN, '/dev/stdin'],
      rendered(() => {})
    );

    expect(status).toBe(0);
    expect(stdout).toBe(
      'No PR moved, and no entry, discovered repo, manual check, or reason for no QA differs.\n'
    );
  });

  it('prints each PR whose place changed, with where it was and where it is', () => {
    const { stdout } = diff([PLAN, '/dev/stdin'], untested, '36137,37344');

    expect(stdout).toContain('#36137 moved: tested by `story-sort-in-main` -> manual QA\n');
    expect(stdout).toContain('#37344 moved: manual QA -> no QA\n');
  });

  it('prints the entries removed and added, with their batch and repos', () => {
    const removed = diff([PLAN, '/dev/stdin'], untested, '36137,37344');
    const added = diff(['/dev/stdin', PLAN], untested, '36137,37344');

    expect(removed.stdout).toContain(
      'Entry removed: `story-sort-in-main` in batch 1 on `mealdrop`\n'
    );
    expect(added.stdout).toContain('Entry added: `story-sort-in-main` in batch 1 on `mealdrop`\n');
  });

  it('marks a probe among the entries', () => {
    const { stdout } = diff(
      [PLAN, '/dev/stdin'],
      rendered((draft) => {
        draft.entries = draft.entries.filter((entry) => entry.slug !== 'animation-probe');
        draft.decisions['31900'] = { entries: ['preview-animations'] };
      }),
      '31900'
    );

    expect(stdout).toContain(
      'Entry removed: `animation-probe`, a probe, in batch 3 on `mealdrop`\n'
    );
  });

  it('prints an entry that changed, with its batch and repos before and after and what changed', () => {
    const { stdout } = diff(
      [PLAN, '/dev/stdin'],
      rendered((draft) => {
        const entry = draft.entries.find((it) => it.slug === 'csf-factory-namespaces')!;
        entry.batch = 2;
        entry.steps = ['Start the dev server.'];
      })
    );

    expect(stdout).toBe(
      'Entry changed: `csf-factory-namespaces` in batch 1 on `mealdrop`, `mantine` -> `csf-factory-namespaces` in batch 2 on `mealdrop`, `mantine`, in its batch, steps\n'
    );
  });

  it('prints the discovered repos removed and added', () => {
    const struck = rendered((draft) => {
      draft.discovered = [];
      const entry = draft.entries.find((it) => it.slug === 'sidebar-tree')!;
      entry.repos = entry.repos.filter((repo) => repo.id !== 'primer-react');
    });

    expect(diff([PLAN, '/dev/stdin'], struck).stdout).toContain(
      'Discovered repo removed: `primer-react` primer/react\n'
    );
    expect(diff(['/dev/stdin', PLAN], struck).stdout).toContain(
      'Discovered repo added: `primer-react` primer/react\n'
    );
  });

  it('prints the manual checks removed and added, with their PRs', () => {
    const { stdout } = diff([PLAN, '/dev/stdin'], untested, '36137,37344');

    expect(stdout).toContain('Manual check removed: On Windows 11, make a React project');
    expect(stdout).toContain(
      'Manual check added: In a project whose preview file sets a story sort, run the upgrade. (#36137)\n'
    );
  });

  it('prints the reasons for no QA removed and added, with their PRs, also a reworded one', () => {
    const { status, stdout } = diff(
      [PLAN, '/dev/stdin'],
      rendered((draft) => {
        draft.decisions['35618'] = { none: 'the docs E2E tests of this repository cover it' };
      })
    );

    expect(status).toBe(0);
    expect(stdout).toBe(
      "No-QA reason removed: the monorepo's docs E2E tests cover the timing (#35618)\nNo-QA reason added: the docs E2E tests of this repository cover it (#35618)\n"
    );
  });

  it('exits 1 with a line for each PR that moved and that --moved does not name', () => {
    const { status, stderr } = diff([PLAN, '/dev/stdin'], untested, '36137');

    expect(status).toBe(1);
    expect(stderr).toBe('#37344 moved, and --moved does not name it.\n');
    expect(diff([PLAN, '/dev/stdin'], untested, '36137,37344').status).toBe(0);
  });

  it('marks in its line a PR that moved and that --moved does not name', () => {
    const { stdout } = diff([PLAN, '/dev/stdin'], untested, '36137');

    expect(stdout).toContain('#36137 moved: tested by `story-sort-in-main` -> manual QA\n');
    expect(stdout).toContain('#37344 moved: manual QA -> no QA, and --moved does not name it\n');
  });

  it('exits 1 with a line for each PR that --moved names and that did not move', () => {
    const { status, stderr } = diff([PLAN, '/dev/stdin'], untested, '36137,37344,35618,36664');

    expect(status).toBe(1);
    expect(stderr).toBe(
      '#35618 did not move, and --moved names it.\n#36664 did not move, and --moved names it.\n'
    );
  });
});

describe('qa-plan.ts ledger', () => {
  it('prints a row for each PR of the window, also one that the plan does not name', () => {
    const window = new URL('./plan.fixture.window.json', import.meta.url).pathname;
    const { status, stdout } = qaPlan(['ledger', '/dev/stdin', '--window', window], FIXTURE);

    expect(status).toBe(0);
    expect(stdout).toContain('| 36153 | qa:success | Addon A11y |');
    expect(stdout.split('\n').filter((line) => /^\| \d/.test(line))).toHaveLength(12);
  });
});
