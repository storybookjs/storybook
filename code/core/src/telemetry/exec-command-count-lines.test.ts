import type { Transform } from 'node:stream';
import { PassThrough } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { spawnSubprocess as rawSpawnSubprocess } from '../common/utils/subprocess.ts';
import { execCommandCountLines } from './exec-command-count-lines.ts';

vi.mock('../common/utils/subprocess.ts', { spy: true });

const spawnSubprocess = vi.mocked(rawSpawnSubprocess);
beforeEach(() => {
  spawnSubprocess.mockReset();
});

type SubprocessStreamer = typeof Promise & {
  stdout: Transform;
  kill: () => void;
};

function createSubprocessStreamer() {
  let resolver: () => void;
  const promiseLike = new Promise<void>((aResolver) => {
    resolver = aResolver;
  }) as unknown as SubprocessStreamer;

  promiseLike.stdout = new PassThrough();
  // @ts-expect-error technically it is invalid to use resolver "before" it is assigned (but not really)
  promiseLike.kill = resolver;
  return promiseLike;
}

describe('execCommandCountLines', () => {
  it('counts lines, many', async () => {
    const streamer = createSubprocessStreamer();
    spawnSubprocess.mockReturnValue(streamer as unknown as ReturnType<typeof spawnSubprocess>);

    const promise = execCommandCountLines('some command', []);

    streamer.stdout.write('First line\n');
    streamer.stdout.write('Second line\n');
    streamer.kill();

    expect(await promise).toEqual(2);
  });

  it('counts lines, one', async () => {
    const streamer = createSubprocessStreamer();
    spawnSubprocess.mockReturnValue(streamer as unknown as ReturnType<typeof spawnSubprocess>);

    const promise = execCommandCountLines('some command', []);

    streamer.stdout.write('First line\n');
    streamer.kill();

    expect(await promise).toEqual(1);
  });

  it('counts lines, none', async () => {
    const streamer = createSubprocessStreamer();
    spawnSubprocess.mockReturnValue(streamer as unknown as ReturnType<typeof spawnSubprocess>);

    const promise = execCommandCountLines('some command', []);

    streamer.kill();

    expect(await promise).toEqual(0);
  });
});
