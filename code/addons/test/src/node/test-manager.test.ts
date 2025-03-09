import { describe, expect, it, vi } from 'vitest';
import { createVitest as actualCreateVitest } from 'vitest/node';

import { Channel, type ChannelTransport } from 'storybook/internal/channels';
import { experimental_MockUniversalStore } from 'storybook/internal/core-server';
import type { StoryIndex } from 'storybook/internal/types';

import path from 'pathe';

import { TEST_PROVIDER_ID, storeOptions } from '../constants';
import { TestManager } from './test-manager';

const setTestNamePattern = vi.hoisted(() => vi.fn());
const vitest = vi.hoisted(() => ({
  projects: [{}],
  init: vi.fn(),
  close: vi.fn(),
  onCancel: vi.fn(),
  runFiles: vi.fn(),
  cancelCurrentRun: vi.fn(),
  globTestSpecs: vi.fn(),
  getModuleProjects: vi.fn(() => []),
  setGlobalTestNamePattern: setTestNamePattern,
  vite: {
    watcher: {
      removeAllListeners: vi.fn(),
      on: vi.fn(),
    },
    moduleGraph: {
      getModulesByFile: () => [],
      invalidateModule: vi.fn(),
    },
  },
}));

vi.mock('vitest/node', async (importOriginal) => ({
  ...(await importOriginal()),
  createVitest: vi.fn(() => Promise.resolve(vitest)),
}));
const createVitest = vi.mocked(actualCreateVitest);

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

global.fetch = vi.fn().mockResolvedValue({
  json: () =>
    new Promise((resolve) =>
      resolve({
        v: 5,
        entries: {
          'story--one': {
            type: 'story',
            id: 'story--one',
            name: 'One',
            title: 'story/one',
            importPath: 'path/to/file',
            tags: ['test'],
          },
          'another--one': {
            type: 'story',
            id: 'another--one',
            name: 'One',
            title: 'another/one',
            importPath: 'path/to/another/file',
            tags: ['test'],
          },
        },
      } as StoryIndex)
    ),
});

const options: ConstructorParameters<typeof TestManager>[2] = {
  onError: (message, error) => {
    throw error;
  },
  onReady: vi.fn(),
};

describe('TestManager', () => {
  it('should create a vitest instance', async () => {
    new TestManager(mockChannel, new experimental_MockUniversalStore(storeOptions, vi), options);
    await vi.waitFor(() => {
      expect(createVitest).toHaveBeenCalled();
    });
  });

  it('should call onReady callback', async () => {
    new TestManager(mockChannel, new experimental_MockUniversalStore(storeOptions, vi), options);
    await vi.waitFor(() => {
      expect(options.onReady).toHaveBeenCalled();
    });
  });

  it('TestManager.start should start vitest and resolve when ready', async () => {
    const testManager = await TestManager.start(
      mockChannel,
      new experimental_MockUniversalStore(storeOptions, vi),
      options
    );
    expect(testManager).toBeInstanceOf(TestManager);
    expect(createVitest).toHaveBeenCalled();
  });

  it('should handle watch mode request', async () => {
    const testManager = await TestManager.start(
      mockChannel,
      new experimental_MockUniversalStore(storeOptions, vi),
      options
    );
    expect(createVitest).toHaveBeenCalledTimes(1);

    await testManager.handleWatchModeRequest(true);
    expect(createVitest).toHaveBeenCalledTimes(1); // shouldn't restart vitest
  });

  it('should handle run request', async () => {
    vitest.globTestSpecs.mockImplementation(() => tests);
    const testManager = await TestManager.start(
      mockChannel,
      new experimental_MockUniversalStore(storeOptions, vi),
      options
    );
    expect(createVitest).toHaveBeenCalledTimes(1);

    await testManager.handleRunRequest({
      providerId: TEST_PROVIDER_ID,
      indexUrl: 'http://localhost:6006/index.json',
    });
    expect(createVitest).toHaveBeenCalledTimes(1);
    expect(vitest.runFiles).toHaveBeenCalledWith(tests, true);
  });

  it('should filter tests', async () => {
    vitest.globTestSpecs.mockImplementation(() => tests);
    const testManager = await TestManager.start(
      mockChannel,
      new experimental_MockUniversalStore(storeOptions, vi),
      options
    );

    await testManager.handleRunRequest({
      providerId: TEST_PROVIDER_ID,
      indexUrl: 'http://localhost:6006/index.json',
      storyIds: [],
    });
    expect(vitest.runFiles).toHaveBeenCalledWith([], true);

    await testManager.handleRunRequest({
      providerId: TEST_PROVIDER_ID,
      indexUrl: 'http://localhost:6006/index.json',
      storyIds: ['story--one'],
    });
    expect(setTestNamePattern).toHaveBeenCalledWith(/^One$/);
    expect(vitest.runFiles).toHaveBeenCalledWith(tests.slice(0, 1), true);
  });

  it('should handle coverage toggling', async () => {
    const testManager = await TestManager.start(
      mockChannel,
      new experimental_MockUniversalStore(storeOptions, vi),
      options
    );
    expect(createVitest).toHaveBeenCalledTimes(1);
    createVitest.mockClear();

    await testManager.handleConfigChange(
      {
        coverage: true,
        a11y: false,
      },
      {
        coverage: false,
        a11y: false,
      }
    );
    expect(createVitest).toHaveBeenCalledTimes(1);
    createVitest.mockClear();

    await testManager.handleConfigChange(
      {
        coverage: false,
        a11y: false,
      },
      {
        coverage: true,
        a11y: false,
      }
    );
    expect(createVitest).toHaveBeenCalledTimes(1);
  });

  it('should temporarily disable coverage on focused tests', async () => {
    vitest.globTestSpecs.mockImplementation(() => tests);
    const mockStore = new experimental_MockUniversalStore(storeOptions, vi);
    const testManager = await TestManager.start(mockChannel, mockStore, options);

    expect(createVitest).toHaveBeenCalledTimes(1);
    createVitest.mockClear();

    mockStore.setState((s) => ({ ...s, config: { coverage: true, a11y: false } }));

    await vi.waitFor(() => {
      expect(createVitest).toHaveBeenCalledTimes(1);
    });

    createVitest.mockClear();

    await testManager.handleRunRequest({
      providerId: TEST_PROVIDER_ID,
      indexUrl: 'http://localhost:6006/index.json',
      storyIds: ['button--primary', 'button--secondary'],
    });

    // expect vitest to be restarted twice, without and with coverage
    expect(createVitest).toHaveBeenCalledTimes(2);
    expect(vitest.runFiles).toHaveBeenCalledWith([], true);
    createVitest.mockClear();

    await testManager.handleRunRequest({
      providerId: TEST_PROVIDER_ID,
      indexUrl: 'http://localhost:6006/index.json',
    });
    // don't expect vitest to be restarted, as we're running all tests
    expect(createVitest).not.toHaveBeenCalled();
    expect(vitest.runFiles).toHaveBeenCalledWith(tests, true);
  });
});
