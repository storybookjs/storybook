import { describe, expect, it, vi } from 'vitest';
import { createVitest as actualCreateVitest } from 'vitest/node';

import { experimental_MockUniversalStore } from 'storybook/internal/core-server';
import type {
  Options,
  StatusStoreByTypeId,
  StoryIndex,
  TestProviderStoreById,
} from 'storybook/internal/types';

import path from 'pathe';

import { STATUS_TYPE_ID_A11Y, STATUS_TYPE_ID_COMPONENT_TEST, storeOptions } from '../constants';
import type { StoreEvent, StoreState } from '../types';
import { TestManager, type TestManagerOptions } from './test-manager';
import { DOUBLE_SPACES } from './vitest-manager';

const setTestNamePattern = vi.hoisted(() => vi.fn());
const vitest = vi.hoisted(() => ({
  projects: [{}],
  init: vi.fn(),
  close: vi.fn(),
  onCancel: vi.fn(),
  runTestSpecifications: vi.fn(),
  cancelCurrentRun: vi.fn(),
  globTestSpecifications: vi.fn(),
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
  config: {
    coverage: { enabled: false },
  },
}));

vi.mock('vitest/node', async (importOriginal) => ({
  ...(await importOriginal()),
  createVitest: vi.fn(() => Promise.resolve(vitest)),
}));

const createVitest = vi.mocked(actualCreateVitest);

const mockStore = new experimental_MockUniversalStore<StoreState, StoreEvent>(
  {
    ...storeOptions,
    initialState: { ...storeOptions.initialState, indexUrl: 'http://localhost:6006/index.json' },
  },
  vi
);
const mockComponentTestStatusStore: StatusStoreByTypeId = {
  set: vi.fn(),
  getAll: vi.fn(),
  onAllStatusChange: vi.fn(),
  onSelect: vi.fn(),
  unset: vi.fn(),
  typeId: STATUS_TYPE_ID_COMPONENT_TEST,
};
const mockA11yStatusStore: StatusStoreByTypeId = {
  set: vi.fn(),
  getAll: vi.fn(),
  onAllStatusChange: vi.fn(),
  onSelect: vi.fn(),
  unset: vi.fn(),
  typeId: STATUS_TYPE_ID_A11Y,
};
const mockTestProviderStore: TestProviderStoreById = {
  getState: vi.fn(),
  setState: vi.fn(),
  settingsChanged: vi.fn(),
  onRunAll: vi.fn(),
  onClearAll: vi.fn(),
  runWithState: vi.fn((callback) => callback()),
  testProviderId: 'test-provider-id',
};

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
            subtype: 'story',
            id: 'story--one',
            name: 'One',
            title: 'story/one',
            importPath: 'path/to/file',
            tags: ['test'],
          },
          'another--one': {
            type: 'story',
            subtype: 'story',
            id: 'another--one',
            name: 'One',
            title: 'another/one',
            importPath: 'path/to/another/file',
            tags: ['test'],
          },
          'parent--story': {
            type: 'story',
            subtype: 'story',
            id: 'parent--story',
            name: 'Parent story',
            title: 'parent/story',
            importPath: 'path/to/parent/file',
            tags: ['test'],
          },
          'parent--story:test': {
            type: 'story',
            subtype: 'test',
            id: 'parent--story:test',
            name: 'Test name',
            title: 'parent/story',
            parent: 'parent--story',
            importPath: 'path/to/parent/file',
            tags: ['test', 'test-fn'],
          },
        },
      } as StoryIndex)
    ),
});

const options: TestManagerOptions = {
  store: mockStore,
  componentTestStatusStore: mockComponentTestStatusStore,
  a11yStatusStore: mockA11yStatusStore,
  testProviderStore: mockTestProviderStore,
  onError: (message, error) => {
    throw error;
  },
  onReady: vi.fn(),
  storybookOptions: {
    configDir: '.storybook',
  } as Options,
};

describe('TestManager', () => {
  it('should create a vitest instance', async () => {
    new TestManager(options);
    await vi.waitFor(() => {
      expect(createVitest).toHaveBeenCalled();
    });
  });

  it('should call onReady callback', async () => {
    new TestManager(options);
    await vi.waitFor(() => {
      expect(options.onReady).toHaveBeenCalled();
    });
  });

  it('TestManager.start should start vitest and resolve when ready', async () => {
    const testManager = await TestManager.start(options);

    expect(testManager).toBeInstanceOf(TestManager);
    expect(createVitest).toHaveBeenCalled();
  });

  it('should handle run request', async () => {
    vitest.globTestSpecifications.mockImplementation(() => tests);
    const testManager = await TestManager.start(options);
    expect(createVitest).toHaveBeenCalledTimes(1);

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        triggeredBy: 'global',
      },
    });
    expect(createVitest).toHaveBeenCalledTimes(1);
    expect(vitest.runTestSpecifications).toHaveBeenCalledWith(tests, true);
  });

  it('should filter tests', async () => {
    vitest.globTestSpecifications.mockImplementation(() => tests);
    const testManager = await TestManager.start(options);

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        storyIds: ['story--one'],
        triggeredBy: 'global',
      },
    });
    expect(setTestNamePattern).toHaveBeenCalledWith(new RegExp(`^One$`));
    expect(vitest.runTestSpecifications).toHaveBeenCalledWith(tests.slice(0, 1), true);
  });

  it('should trigger a single story render test', async () => {
    vitest.globTestSpecifications.mockImplementation(() => tests);
    const testManager = await TestManager.start(options);

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        storyIds: ['another--one'],
        triggeredBy: 'global',
      },
    });
    // regex should be exact match of the story name
    expect(setTestNamePattern).toHaveBeenCalledWith(new RegExp(`^One$`));
  });

  it('should trigger a single story test', async () => {
    vitest.globTestSpecifications.mockImplementation(() => tests);
    const testManager = await TestManager.start(options);

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        storyIds: ['parent--story:test'],
        triggeredBy: 'global',
      },
    });
    // regex should be Parent Story Name + Test Name
    expect(setTestNamePattern).toHaveBeenCalledWith(
      new RegExp(`^Parent story${DOUBLE_SPACES} Test name$`)
    );
  });

  it('should trigger all tests of a story', async () => {
    vitest.globTestSpecifications.mockImplementation(() => tests);
    const testManager = await TestManager.start(options);

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        storyIds: ['parent--story'],
        triggeredBy: 'global',
      },
    });
    expect(setTestNamePattern).toHaveBeenCalledWith(new RegExp(`^Parent story${DOUBLE_SPACES}`));
  });

  it('should restart Vitest before a test run if coverage is enabled', async () => {
    const testManager = await TestManager.start(options);
    expect(createVitest).toHaveBeenCalledTimes(1);
    createVitest.mockClear();

    mockStore.setState((s) => ({ ...s, config: { coverage: true, a11y: false } }));

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        triggeredBy: 'global',
      },
    });

    expect(createVitest).toHaveBeenCalledTimes(1);
    expect(createVitest).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({
        coverage: expect.objectContaining({ enabled: true }),
      })
    );
  });

  it('should not restart with coverage enabled Vitest before a focused test run', async () => {
    const testManager = await TestManager.start(options);
    expect(createVitest).toHaveBeenCalledTimes(1);
    createVitest.mockClear();

    mockStore.setState((s) => ({ ...s, config: { coverage: true, a11y: false } }));

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        storyIds: ['story--one'],
        triggeredBy: 'global',
      },
    });

    expect(createVitest).not.toHaveBeenCalled();
  });
});
