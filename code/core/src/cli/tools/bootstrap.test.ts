import type { Channel } from 'storybook/internal/channels';
import {
  experimental_loadStorybook,
  prepareHeadlessUniversalStores,
  resolveChangeDetectionAdapter,
} from 'storybook/internal/core-server';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bootstrapToolsRuntime } from './bootstrap.ts';

vi.mock('storybook/internal/core-server', { spy: true });

beforeEach(() => {
  vi.mocked(prepareHeadlessUniversalStores).mockReset();
  vi.mocked(experimental_loadStorybook).mockReset();
  vi.mocked(resolveChangeDetectionAdapter).mockImplementation(() => {});
});

describe('bootstrapToolsRuntime', () => {
  it('loads the configuration on the same channel the stores were prepared on', async () => {
    // Addon responders answer requests and relay child-process store events over the channel
    // their preset hooks received; leader stores only hear events on the channel they were
    // prepared with. A second channel on either side silently severs that path and a test run
    // would hang forever, so the object identity is the contract.
    const channel = { isPreparedChannel: true } as unknown as Channel;
    vi.mocked(prepareHeadlessUniversalStores).mockReturnValue(channel);
    vi.mocked(experimental_loadStorybook).mockResolvedValue({} as never);

    await bootstrapToolsRuntime(
      { cwd: process.cwd(), configDir: '.storybook' },
      { hostModuleGraph: false }
    );

    expect(experimental_loadStorybook).toHaveBeenCalledWith(expect.objectContaining({ channel }));
  });
});
