import { describe, expect, it, vi } from 'vitest';
import { createVitest } from 'vitest/node';

import { Channel, type ChannelTransport } from '@storybook/core/channels';

import path from 'pathe';

import { TEST_PROVIDER_ID } from '../constants';
import { TestManager } from './test-manager';

const vitest = vi.hoisted(() => ({
  projects: [{}],
  init: vi.fn(),
  close: vi.fn(),
  onCancel: vi.fn(),
  runFiles: vi.fn(),
  cancelCurrentRun: vi.fn(),
  globTestSpecs: vi.fn(),
  getModuleProjects: vi.fn(() => []),
}));

vi.mock('vitest/node', () => ({
  createVitest: vi.fn(() => Promise.resolve(vitest)),
}));

const transport = { setHandler: vi.fn(), send: vi.fn() } satisfies ChannelTransport;
const mockChannel = new Channel({ transport });

const tests = [
  {
    project: { config: { env: { __STORYBOOK_URL__: 'http://localhost:6006' } } },
    moduleId: path.join(process.cwd(), 'path/to/file'),
  },
  {
    project: { config: { env: { __STORYBOOK_URL__: 'http://localhost:6006' } } },
    moduleId: path.join(process.cwd(), 'path/to/another/file'),
  },
];

const options: ConstructorParameters<typeof TestManager>[1] = {
  onError: (message, error) => {
    throw error;
  },
  onReady: vi.fn(),
};

describe('TestManager', () => {
  it('should create a vitest instance', async () => {
    new TestManager(mockChannel, options);
    await new Promise((r) => setTimeout(r, 1000));
    expect(createVitest).toHaveBeenCalled();
  });

  it('should call onReady callback', async () => {
    new TestManager(mockChannel, options);
    await new Promise((r) => setTimeout(r, 1000));
    expect(options.onReady).toHaveBeenCalled();
  });

  it('TestManager.start should start vitest and resolve when ready', async () => {
    const testManager = await TestManager.start(mockChannel, options);
    expect(testManager).toBeInstanceOf(TestManager);
    expect(createVitest).toHaveBeenCalled();
  });

  it('should handle watch mode request', async () => {
    const testManager = await TestManager.start(mockChannel, options);
    expect(testManager.watchMode).toBe(false);
    expect(createVitest).toHaveBeenCalledTimes(1);

    await testManager.handleWatchModeRequest({ providerId: TEST_PROVIDER_ID, watchMode: true });
    expect(testManager.watchMode).toBe(true);
    expect(createVitest).toHaveBeenCalledTimes(2);
  });

  it('should handle run request', async () => {
    vitest.globTestSpecs.mockImplementation(() => tests);
    const testManager = await TestManager.start(mockChannel, options);
    expect(createVitest).toHaveBeenCalledTimes(1);

    await testManager.handleRunRequest({
      providerId: TEST_PROVIDER_ID,
      payload: [
        {
          stories: [],
          importPath: 'path/to/file',
          componentPath: 'path/to/component',
        },
        {
          stories: [],
          importPath: 'path/to/another/file',
          componentPath: 'path/to/another/component',
        },
      ],
    });
    expect(createVitest).toHaveBeenCalledTimes(1);
    expect(vitest.runFiles).toHaveBeenCalledWith(tests, true);
  });

  it('should filter tests', async () => {
    vitest.globTestSpecs.mockImplementation(() => tests);
    const testManager = await TestManager.start(mockChannel, options);

    await testManager.handleRunRequest({
      providerId: TEST_PROVIDER_ID,
      payload: [
        {
          stories: [],
          importPath: 'path/to/unknown/file',
          componentPath: 'path/to/unknown/component',
        },
      ],
    });
    expect(vitest.runFiles).toHaveBeenCalledWith([], true);

    await testManager.handleRunRequest({
      providerId: TEST_PROVIDER_ID,
      payload: [
        {
          stories: [],
          importPath: 'path/to/file',
          componentPath: 'path/to/component',
        },
      ],
    });
    expect(vitest.runFiles).toHaveBeenCalledWith(tests.slice(0, 1), true);
  });

  it('should handle run all request', async () => {
    const testManager = await TestManager.start(mockChannel, options);
    expect(createVitest).toHaveBeenCalledTimes(1);

    await testManager.handleRunAllRequest({ providerId: TEST_PROVIDER_ID });
    expect(createVitest).toHaveBeenCalledTimes(1);
    expect(vitest.runFiles).toHaveBeenCalledWith(tests, true);
  });
});
