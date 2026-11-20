import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { beforeEach, describe, expect, it } from 'vitest';

const COMMAND = new URL('../manual-issue.ts', import.meta.url).pathname;
const STAND_IN = new URL('./gh.stand-in.mjs', import.meta.url).pathname;
const FIXTURE = readFileSync(new URL('./plan.fixture.md', import.meta.url), 'utf8');
const WINDOW = new URL('./plan.fixture.window.json', import.meta.url).pathname;
const COMMIT = '772120e5d39e696fc7bb196c482814fea193892b';

type Issue = { number: number; title: string; milestone: string; body: string; indexed: boolean };
type State = { calls: string[][]; issues: Issue[]; milestones: string[] };

let dir: string;
const statePath = () => join(dir, 'state.json');
const readState = (): State => JSON.parse(readFileSync(statePath(), 'utf8'));
const writeState = (state: State) => writeFileSync(statePath(), JSON.stringify(state));

const manualIssue = (plan: string, extra: string[] = []) => {
  const file = join(dir, '11.0.md');
  writeFileSync(file, plan);
  return spawnSync(
    process.execPath,
    [COMMAND, '--plan', file, '--window', WINDOW, '--repo', 'storybookjs/storybook'].concat(
      ['--commit', COMMIT],
      extra
    ),
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_ACTIONS: '',
        GH_STAND_IN_STATE: statePath(),
        PATH: `${join(dir, 'bin')}:${process.env.PATH}`,
      },
    }
  );
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'qa-manual-issue-'));
  mkdirSync(join(dir, 'bin'));
  copyFileSync(STAND_IN, join(dir, 'bin', 'gh'));
  chmodSync(join(dir, 'bin', 'gh'), 0o755);
  writeState({ calls: [], issues: [], milestones: ['10.6', '11'] });
});

const creates = (state: State) => state.calls.filter(([command]) => command === 'issue');

describe('manual-issue.ts', () => {
  it('creates the issue of a plan once, also before the search sees it, and again for a changed plan', () => {
    const first = manualIssue(FIXTURE);

    expect(first.status).toBe(0);
    const [create] = creates(readState());
    expect(create).toEqual([
      ...['issue', 'create', '--repo', 'storybookjs/storybook'],
      ...['--title', '[SB 11 QA] Manual QA for Storybook 11.0 at 11.0.0-beta.3'],
      ...['--body-file', expect.stringMatching(/body\.md$/), '--milestone', '11'],
    ]);
    const [issue] = readState().issues;
    expect(issue!.body).toMatch(/^<!-- sb-qa-manual [0-9a-f]{12} 11\.0\.md -->\n# Manual QA/);

    const second = manualIssue(FIXTURE);

    expect(second.status).toBe(0);
    expect(second.stdout).toContain('exists as #1000 (open)');
    expect(creates(readState())).toHaveLength(1);

    const changed = manualIssue(
      FIXTURE.replace('| Entries per run | 2 |', '| Entries per run | 4 |')
    );

    expect(changed.status).toBe(0);
    expect(creates(readState())).toHaveLength(2);
    const [before, after] = readState().issues.map(({ body }) => body.split('\n', 1)[0]);
    expect(after).toMatch(/^<!-- sb-qa-manual [0-9a-f]{12} 11\.0\.md -->$/);
    expect(after).not.toBe(before);
  });

  it('creates nothing when the milestone of the line is missing, and names it', () => {
    writeState({ ...readState(), milestones: ['10.6'] });

    const { status, stderr } = manualIssue(FIXTURE);

    expect(status).toBe(1);
    expect(stderr).toContain('milestone "11" does not exist or is closed');
    expect(creates(readState())).toHaveLength(0);
  });

  it('prints the issue it would create and creates none', () => {
    const { status, stdout } = manualIssue(FIXTURE, ['--print']);

    expect(status).toBe(0);
    expect(stdout).toMatch(
      /^New issue in storybookjs\/storybook, milestone 11: \[SB 11 QA\] Manual QA for Storybook 11\.0 at 11\.0\.0-beta\.3\n\n<!-- sb-qa-manual /
    );
    expect(creates(readState())).toHaveLength(0);
  });
});
