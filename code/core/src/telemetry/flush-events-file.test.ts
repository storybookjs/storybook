import { beforeEach, expect, it, vi } from 'vitest';

import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as memfs from 'memfs';
import { vol } from 'memfs';

import { flushEventsFile } from './flush-events-file.ts';
import { postEvent } from './post-event.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('./post-event.ts', () => ({ postEvent: vi.fn(async () => {}) }));

const file = join(tmpdir(), 'storybook-telemetry-abc_-123.json');

beforeEach(async () => {
  vol.reset();
  const fs = await import('node:fs/promises');
  vi.mocked(fs.readFile).mockImplementation(memfs.fs.promises.readFile as any);
  vi.mocked(fs.rm).mockImplementation(memfs.fs.promises.rm as any);
  vi.mocked(postEvent).mockClear();
});

it('posts every event in the file and removes the file', async () => {
  const events = [{ body: { eventId: 'a' } }, { body: { eventId: 'b' }, retryDelay: 5 }];
  vol.fromJSON({ [file]: JSON.stringify(events) });

  await flushEventsFile(file);

  expect(vi.mocked(postEvent).mock.calls.map(([event]) => event)).toEqual(events);
  expect(vi.mocked(postEvent).mock.calls[0][1]).toMatchObject({ keepProcessAlive: true });
  expect(vol.existsSync(file)).toBe(false);
});

it('keeps delivering the others when one post fails', async () => {
  vi.mocked(postEvent).mockRejectedValueOnce(new Error('network'));
  vol.fromJSON({
    [file]: JSON.stringify([{ body: { eventId: 'a' } }, { body: { eventId: 'b' } }]),
  });

  await expect(flushEventsFile(file)).resolves.toBeUndefined();

  expect(postEvent).toHaveBeenCalledTimes(2);
});

it('removes a file it cannot parse', async () => {
  vol.fromJSON({ [file]: '[{"body":' });

  await expect(flushEventsFile(file)).rejects.toThrow();

  expect(vol.existsSync(file)).toBe(false);
  expect(postEvent).not.toHaveBeenCalled();
});

it.each([join(tmpdir(), 'package.json'), '/project/storybook-telemetry-abc.json'])(
  'leaves %s alone, which is not a hand-over file',
  async (other) => {
    vol.fromJSON({ [other]: '[]' });

    await flushEventsFile(other);

    expect(vol.existsSync(other)).toBe(true);
    expect(postEvent).not.toHaveBeenCalled();
  }
);
