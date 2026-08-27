import type { Channel } from 'storybook/internal/channels';
import {
  experimental_loadStorybook,
  experimental_resetChangeDetectionReadiness,
  experimental_resetServicesPresetOnce,
  experimental_setChangeDetectionHost,
  prepareHeadlessUniversalStores,
} from 'storybook/internal/core-server';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as v from 'valibot';

import { defineToolset } from '../../../shared/open-service/toolset-definition.ts';
import {
  clearToolsetRegistry,
  getRegisteredToolsets,
  registerToolset,
} from '../../../shared/open-service/toolset-registry.ts';
import { bootstrapToolsRuntime } from './local-runtime.ts';

vi.mock('storybook/internal/core-server', { spy: true });

beforeEach(() => {
  clearToolsetRegistry();
  vi.mocked(prepareHeadlessUniversalStores).mockReset();
  vi.mocked(experimental_loadStorybook).mockReset();
  vi.mocked(experimental_resetServicesPresetOnce).mockReset();
  vi.mocked(experimental_resetChangeDetectionReadiness).mockReset();
  vi.mocked(experimental_setChangeDetectionHost).mockReset();
});

describe('bootstrapToolsRuntime', () => {
  it('loads the configuration on the same channel the stores were prepared on', async () => {
    // Addon responders answer requests and relay child-process store events over the channel
    // their preset hooks received; leader stores only hear events on the channel they were
    // prepared with. A second channel on either side silently severs that path and a test run
    // would hang forever, so the object identity is the contract.
    const channel = { isPreparedChannel: true } as unknown as Channel;
    const options = {};
    const setChangeDetectionHost = vi.fn();
    vi.mocked(prepareHeadlessUniversalStores).mockReturnValue(channel);
    vi.mocked(experimental_loadStorybook).mockResolvedValue(options as never);

    await bootstrapToolsRuntime(
      { cwd: process.cwd(), configDir: '.storybook' },
      { setChangeDetectionHost }
    );

    expect(experimental_loadStorybook).toHaveBeenCalledWith(expect.objectContaining({ channel }));
    expect(setChangeDetectionHost).toHaveBeenCalledOnce();
    expect(setChangeDetectionHost).toHaveBeenCalledWith(expect.any(Function));
  });

  it('does not change process.cwd()', async () => {
    const cwdBefore = process.cwd();
    vi.mocked(prepareHeadlessUniversalStores).mockReturnValue({} as Channel);
    vi.mocked(experimental_loadStorybook).mockResolvedValue({} as never);

    await bootstrapToolsRuntime({ cwd: process.cwd(), configDir: '.storybook' });

    expect(process.cwd()).toBe(cwdBefore);
  });

  it('refuses a target directory other than process.cwd()', async () => {
    const cwdBefore = process.cwd();

    await expect(
      bootstrapToolsRuntime({ cwd: '/elsewhere', configDir: '.storybook' })
    ).rejects.toThrow('requires process.cwd()');
    expect(process.cwd()).toBe(cwdBefore);
    expect(experimental_loadStorybook).not.toHaveBeenCalled();
  });

  it('clears process-global registries when closed so a later host can target another project', async () => {
    const channel = {} as Channel;
    vi.mocked(prepareHeadlessUniversalStores).mockReturnValue(channel);
    vi.mocked(experimental_loadStorybook).mockResolvedValue({} as never);

    const runtime = await bootstrapToolsRuntime({ cwd: process.cwd(), configDir: '.storybook' });
    registerToolset(
      defineToolset({
        id: 'echo',
        description: 'Temporary catalog entry.',
        methods: {
          ok: {
            title: 'ok',
            description: 'ok',
            input: v.object({}),
            handler: async () => ({ ok: true as const, data: {}, markdown: '' }),
          },
        },
      })
    );

    expect(getRegisteredToolsets().map((toolset) => toolset.id)).toContain('echo');

    await runtime.close();
    await runtime.close();

    expect(getRegisteredToolsets()).toEqual([]);
    expect(experimental_resetServicesPresetOnce).toHaveBeenCalledOnce();
    expect(experimental_resetChangeDetectionReadiness).toHaveBeenCalledOnce();
    expect(experimental_setChangeDetectionHost).toHaveBeenLastCalledWith(undefined);
  });
});
