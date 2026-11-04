import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';
import { CURRENT_STORY_WAS_SET, STORY_FINISHED } from 'storybook/internal/core-events';

import { type API, addons } from 'storybook/manager-api';

import { createDocgenGate } from './docgenGate.ts';

vi.mock('storybook/manager-api', { spy: true });
vi.mock('./docgenGate.ts', { spy: true });

let channel: Channel;
const api: Pick<API, 'getRefs' | 'findRef'> = {
  getRefs: vi.fn<API['getRefs']>(),
  findRef: vi.fn<API['findRef']>(),
};

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('location', new URL('http://localhost:6006/'));
  vi.stubGlobal('FEATURES', { controls: true, docgenServer: false });
  vi.stubGlobal('DOCGEN_STORY_PREPARED', false);
  channel = new Channel({});
  vi.mocked(addons.register).mockImplementation(() => {});
  vi.mocked(addons.add).mockImplementation(() => {});
  vi.mocked(addons.getChannel).mockReturnValue(channel);
  vi.mocked(api.getRefs).mockReturnValue({
    remote: { id: 'remote', url: 'http://localhost:6006/', previewInitialized: true },
  });
});

afterEach(() => vi.unstubAllGlobals());

it('separates an explicitly identified same-origin ref from the local preview', async () => {
  await import('./manager.tsx');
  const register = vi.mocked(addons.register).mock.calls[0][1];
  register(api as API);
  const result = vi.mocked(createDocgenGate).mock.results[0];
  if (result.type !== 'return') {
    throw new Error('Expected Controls registration to create its docgen gate');
  }
  const gate = result.value;

  const local = {
    type: CURRENT_STORY_WAS_SET,
    from: 'local-preview',
    source: 'http://localhost:6006/iframe.html',
    args: [{ storyId: 'same-story', viewMode: 'story' }],
  };
  const remote = { ...local, from: 'remote-preview', refId: 'remote' };
  channel.receive(local);
  channel.receive(remote);
  channel.receive({ ...remote, type: STORY_FINISHED, args: [{ storyId: 'same-story' }] });

  expect(gate.isReady('same-story', 'remote')).toBe(true);
  expect(gate.isReady('same-story')).toBe(false);

  channel.receive({ ...local, type: STORY_FINISHED, args: [{ storyId: 'same-story' }] });
  expect(gate.isReady('same-story')).toBe(true);
});
