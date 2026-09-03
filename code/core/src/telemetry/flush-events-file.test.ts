import { beforeEach, expect, it, vi } from 'vitest';

import * as memfs from 'memfs';
import { vol } from 'memfs';

import { flushEventsFile } from './flush-events-file.ts';
import { postEvent } from './post-event.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('./post-event.ts', () => ({ postEvent: vi.fn(async () => ({ status: 200 })) }));

beforeEach(async () => {
  vol.reset();
  const fs = await import('node:fs/promises');
  vi.mocked(fs.readFile).mockImplementation(memfs.fs.promises.readFile as any);
  vi.mocked(fs.rm).mockImplementation(memfs.fs.promises.rm as any);
  vi.mocked(postEvent).mockClear();
});

it('posts every event in the file and removes the file', async () => {
  const events = [{ body: { eventId: 'a' } }, { body: { eventId: 'b' }, retryDelay: 5 }];
  vol.fromJSON({ '/project/events.json': JSON.stringify(events) });

  await flushEventsFile('/project/events.json');

  expect(vi.mocked(postEvent).mock.calls.map(([event]) => event)).toEqual(events);
  expect(vi.mocked(postEvent).mock.calls[0][1]).toMatchObject({ keepProcessAlive: true });
  expect(vol.toJSON()).toEqual({ '/project': null });
});

it('keeps delivering the others when one post fails', async () => {
  vi.mocked(postEvent).mockRejectedValueOnce(new Error('network'));
  vol.fromJSON({
    '/project/events.json': JSON.stringify([
      { body: { eventId: 'a' } },
      { body: { eventId: 'b' } },
    ]),
  });

  await expect(flushEventsFile('/project/events.json')).resolves.toBeUndefined();

  expect(postEvent).toHaveBeenCalledTimes(2);
});
