import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

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

describe('qa-plan.ts ledger', () => {
  it('prints a row for each PR of the window, also one that the plan does not name', () => {
    const window = new URL('./plan.fixture.window.json', import.meta.url).pathname;
    const { status, stdout } = qaPlan(['ledger', '/dev/stdin', '--window', window], FIXTURE);

    expect(status).toBe(0);
    expect(stdout).toContain('| 36153 | qa:success | Addon A11y |');
    expect(stdout.split('\n').filter((line) => /^\| \d/.test(line))).toHaveLength(12);
  });
});
