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

const COMMAND = new URL('../manual-discussion.ts', import.meta.url).pathname;
const STAND_IN = new URL('./gh.stand-in.mjs', import.meta.url).pathname;
const FIXTURE = readFileSync(new URL('./plan.fixture.md', import.meta.url), 'utf8');
const WINDOW = new URL('./plan.fixture.window.json', import.meta.url).pathname;
const COMMIT = '772120e5d39e696fc7bb196c482814fea193892b';

type Discussion = { number: number; title: string; body: string; categoryId: string };
type State = { calls: string[][]; discussions: Discussion[] };

let dir: string;
const statePath = () => join(dir, 'state.json');
const readState = (): State => JSON.parse(readFileSync(statePath(), 'utf8'));

const manualDiscussion = (plan: string, extra: string[] = []) => {
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
  dir = mkdtempSync(join(tmpdir(), 'qa-manual-discussion-'));
  mkdirSync(join(dir, 'bin'));
  copyFileSync(STAND_IN, join(dir, 'bin', 'gh'));
  chmodSync(join(dir, 'bin', 'gh'), 0o755);
  writeFileSync(statePath(), JSON.stringify({ calls: [], discussions: [] }));
});

const creates = (state: State) =>
  state.calls.filter((call) => call.some((arg) => arg.includes('createDiscussion(')));

describe('manual-discussion.ts', () => {
  it('creates the discussion of a plan once in QA sweeps, and again for a changed plan', () => {
    const first = manualDiscussion(FIXTURE);

    expect(first.status).toBe(0);
    expect(creates(readState())).toHaveLength(1);
    const [discussion] = readState().discussions;
    expect(discussion).toMatchObject({
      categoryId: 'DIC_qa',
      title: '[SB 11 QA] Manual QA for Storybook 11.0 at 11.0.0-beta.3',
      body: expect.stringMatching(/^<!-- sb-qa-manual [0-9a-f]{12} 11\.0\.md -->\n# Manual QA/),
    });

    const second = manualDiscussion(FIXTURE);

    expect(second.status).toBe(0);
    expect(second.stdout).toContain('exists as #1000');
    expect(creates(readState())).toHaveLength(1);

    const changed = manualDiscussion(
      FIXTURE.replace('| Entries per run | 2 |', '| Entries per run | 4 |')
    );

    expect(changed.status).toBe(0);
    expect(creates(readState())).toHaveLength(2);
    const [before, after] = readState().discussions.map(({ body }) => body.split('\n', 1)[0]);
    expect(after).toMatch(/^<!-- sb-qa-manual [0-9a-f]{12} 11\.0\.md -->$/);
    expect(after).not.toBe(before);
  });

  it('prints the discussion it would create and creates none', () => {
    const { status, stdout } = manualDiscussion(FIXTURE, ['--print']);

    expect(status).toBe(0);
    expect(stdout).toMatch(
      /^New discussion in "QA sweeps" of storybookjs\/storybook: \[SB 11 QA\] Manual QA for Storybook 11\.0 at 11\.0\.0-beta\.3\n\n<!-- sb-qa-manual /
    );
    expect(creates(readState())).toHaveLength(0);
  });
});
