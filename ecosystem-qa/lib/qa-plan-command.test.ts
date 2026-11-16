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
  const at = FIXTURE.indexOf('- Step: Open a story');
  return Buffer.concat([FIXTURE.subarray(0, at + 8), Buffer.of(byte), FIXTURE.subarray(at + 8)]);
};

describe('qa-plan.ts check', () => {
  it('names two plans by different hashes when only bytes that decode alike differ', () => {
    const hashes = [0xfe, 0xff].map((byte) => {
      const { status, stdout } = qaPlan(['check', '/dev/stdin'], withByte(byte));
      expect(status).toBe(0);
      return /plan ([0-9a-f]{12}) /.exec(stdout)?.[1];
    });

    expect(hashes[0]).toBeDefined();
    expect(hashes[0]).not.toBe(hashes[1]);
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
    const row = rendered.split('\n').find((line) => line.startsWith('| [#36153]'))!;
    const { status, stderr } = draft(rendered.replace(`${row}\n`, ''));

    expect(status).toBe(1);
    expect(stderr).toContain(`/dev/stdin is not the plan that render writes from ${WINDOW}.`);
  });
});
