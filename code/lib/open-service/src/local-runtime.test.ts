import { resolve } from 'node:path';

import type { Storybook } from '@storybook/core';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bootstrapToolsRuntime } from './local-runtime.ts';

const createStorybook = vi.fn<(input: unknown) => Promise<Storybook>>();

beforeEach(() => {
  createStorybook.mockReset();
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
      ready: vi.fn().mockResolvedValue(undefined),
      close,
    } as unknown as Storybook;
    createStorybook.mockResolvedValue(storybook);
    const cwd = process.cwd();

    const runtime = await bootstrapToolsRuntime({ cwd, configDir: '.storybook', createStorybook });

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
