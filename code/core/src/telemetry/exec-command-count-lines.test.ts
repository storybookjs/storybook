import type { Transform } from 'node:stream';
import { PassThrough } from 'node:stream';

import { beforeEach, describe, expect, it, vitest } from 'vitest';

// eslint-disable-next-line depend/ban-dependencies
import { execaCommand as rawExecaCommand } from 'execa';

import { execCommandCountLines } from './exec-command-count-lines';

vitest.mock('execa');

const execaCommand = vitest.mocked(rawExecaCommand);
beforeEach(() => {
  execaCommand.mockReset();
});

type ExecaStreamer = typeof Promise & {
  stdout: Transform;
  kill: () => void;
};

function createExecaStreamer() {
  let resolver: () => void;
  const promiseLike: ExecaStreamer = new Promise<void>((aResolver, aRejecter) => {
    resolver = aResolver;
  }) as any;

  promiseLike.stdout = new PassThrough();
  // @ts-expect-error technically it is invalid to use resolver "before" it is assigned (but not really)
  promiseLike.kill = resolver;
  return promiseLike;
}

describe('execCommandCountLines', () => {
  it('counts lines, many', async () => {
    const streamer = createExecaStreamer();
    execaCommand.mockReturnValue(streamer as any);

    const promise = execCommandCountLines('some command');

    streamer.stdout.write('First line\n');
    streamer.stdout.write('Second line\n');
    streamer.kill();

    expect(await promise).toEqual(2);
  });

  it('counts lines, one', async () => {
    const streamer = createExecaStreamer();
    execaCommand.mockReturnValue(streamer as any);

    const promise = execCommandCountLines('some command');

    streamer.stdout.write('First line\n');
    streamer.kill();

    expect(await promise).toEqual(1);
  });

  it('counts lines, none', async () => {
    const streamer = createExecaStreamer();
    execaCommand.mockReturnValue(streamer as any);

    const promise = execCommandCountLines('some command');

    streamer.kill();

    expect(await promise).toEqual(0);
  });
});
