import { resolve } from 'node:path';

import { experimental_setChangeDetectionHost } from '@storybook/core/internal/services';
import type { Storybook } from '@storybook/core';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runWithStorybook } from '@storybook/core/internal/deep/instance/instance-context';
import { bootstrapToolsRuntime } from './local-runtime.ts';

vi.mock('@storybook/core/internal/services', { spy: true });
vi.mock('@storybook/core/internal/deep/instance/instance-context', () => ({
  runWithStorybook: vi.fn((_storybook, fn) => fn()),
}));

const createStorybook = vi.fn<(input: unknown) => Promise<Storybook>>();

beforeEach(() => {
  createStorybook.mockReset();
  vi.mocked(experimental_setChangeDetectionHost).mockReset();
});

describe('bootstrapToolsRuntime', () => {
  it('creates a headless instance and forwards its capabilities and close', async () => {
    const toolsets = [{ id: 'example', description: 'Example.', methods: {} }];
    const getService = vi.fn().mockReturnValue({ queries: {}, commands: {} });
    const close = vi.fn().mockResolvedValue(undefined);
    const storybook = {
      attached: false,
      toolsets: { values: () => toolsets },
      services: { get: getService },
      close,
    } as unknown as Storybook;
    createStorybook.mockResolvedValue(storybook);
    const setChangeDetectionHost = vi.fn();
    const cwd = process.cwd();

    const runtime = await bootstrapToolsRuntime(
      { cwd, configDir: '.storybook', createStorybook },
      { setChangeDetectionHost }
    );

    expect(createStorybook).toHaveBeenCalledWith({
      configDir: resolve(cwd, '.storybook'),
      workingDir: cwd,
      mode: 'headless',
    });
    expect(process.cwd()).toBe(cwd);
    expect(runtime.storybook).toBe(storybook);
    expect(runtime.storybook.attached).toBe(false);
    expect(runtime.toolsets).toEqual(toolsets);
    runtime.getService('example/service');
    expect(getService).toHaveBeenCalledWith('example/service', undefined);
    expect(runWithStorybook).toHaveBeenCalledWith(storybook, expect.any(Function));
    expect(setChangeDetectionHost).toHaveBeenCalledWith(expect.any(Function));
    await runtime.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it('refuses a target directory other than process.cwd()', async () => {
    const cwd = process.cwd();
    await expect(
      bootstrapToolsRuntime({ cwd: '/elsewhere', configDir: '.storybook', createStorybook })
    ).rejects.toThrow('requires process.cwd()');
    expect(process.cwd()).toBe(cwd);
    expect(createStorybook).not.toHaveBeenCalled();
  });
});
