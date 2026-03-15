import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestResult } from 'vitest/node';

import { Tag, experimental_MockUniversalStore } from 'storybook/internal/core-server';
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
  runTestSpecifications: vi.fn().mockResolvedValue(undefined),
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

const mockCreateVitest = vi.fn();

vi.mock('vitest/node', async (importOriginal) => ({
  ...(await importOriginal()),
  createVitest: mockCreateVitest,
}));

// Use the mock function directly
const createVitest = mockCreateVitest;

beforeEach(() => {
  vi.clearAllMocks();
  createVitest.mockResolvedValue(vitest);
  vitest.runTestSpecifications.mockResolvedValue(undefined);
});

const mockIndex = {
  v: 5,
  entries: {
    'story--one': {
      type: 'story',
      subtype: 'story',
      id: 'story--one',
      name: 'One',
      title: 'story/one',
      importPath: 'path/to/file',
      tags: [Tag.TEST],
    },
    'another--one': {
      type: 'story',
      subtype: 'story',
      id: 'another--one',
      name: 'One',
      title: 'another/one',
      importPath: 'path/to/another/file',
      tags: [Tag.TEST],
    },
    'story--two': {
      type: 'story',
      subtype: 'story',
      id: 'story--two',
      name: 'Two',
      title: 'story/two',
      importPath: 'path/to/file',
      tags: [Tag.TEST],
    },
    'another--two': {
      type: 'story',
      subtype: 'story',
      id: 'another--two',
      name: 'Two B',
      title: 'another/two',
      importPath: 'path/to/another/file',
      tags: [Tag.TEST],
    },
    'parent--story': {
      type: 'story',
      subtype: 'story',
      id: 'parent--story',
      name: 'Parent story',
      title: 'parent/story',
      importPath: 'path/to/parent/file',
      tags: [Tag.TEST],
    },
    'parent--story:test': {
      type: 'story',
      subtype: Tag.TEST,
      id: 'parent--story:test',
      name: 'Test name',
      title: 'parent/story',
      parent: 'parent--story',
      importPath: 'path/to/parent/file',
      tags: [Tag.TEST, Tag.TEST_FN],
    },
  },
} as StoryIndex;

const mockStore = new experimental_MockUniversalStore<StoreState, StoreEvent>(
  {
    ...storeOptions,
    initialState: {
      ...storeOptions.initialState,
      index: mockIndex,
    },
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

  it('should trigger only selected stories in the same file', async () => {
    vitest.globTestSpecifications.mockImplementation(() => tests);
    const testManager = await TestManager.start(options);

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        storyIds: ['story--one', 'story--two'],
        triggeredBy: 'global',
      },
    });

    expect(vitest.runTestSpecifications).toHaveBeenCalledWith(tests.slice(0, 1), true);

    const regex = setTestNamePattern.mock.calls.find(([arg]) => arg instanceof RegExp)?.[0] as
      | RegExp
      | undefined;

    expect(regex).toBeDefined();
    expect(regex?.test('One')).toBe(true);
    expect(regex?.test('Two')).toBe(true);
    expect(regex?.test('Parent story  Test name')).toBe(false);
  });

  it('should trigger only selected stories across multiple files', async () => {
    vitest.globTestSpecifications.mockImplementation(() => tests);
    const testManager = await TestManager.start(options);

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        storyIds: ['story--one', 'another--two'],
        triggeredBy: 'global',
      },
    });

    expect(vitest.runTestSpecifications).toHaveBeenCalledWith(tests, true);

    const regex = setTestNamePattern.mock.calls.find(([arg]) => arg instanceof RegExp)?.[0] as
      | RegExp
      | undefined;

    expect(regex).toBeDefined();
    expect(regex?.test('One')).toBe(true);
    expect(regex?.test('Two B')).toBe(true);
    expect(regex?.test('Two')).toBe(false);
  });

  it('should ignore non-requested same-name story results after run', async () => {
    const testManager = await TestManager.start(options);
    const passedResult = { state: 'passed', errors: [] } as unknown as TestResult;

    await testManager.runTestsWithState({
      storyIds: ['story--one', 'another--two'],
      triggeredBy: 'global',
      callback: async () => {
        testManager.onTestCaseResult({
          storyId: 'story--one',
          testResult: passedResult,
        });
        testManager.onTestCaseResult({
          storyId: 'another--one',
          testResult: passedResult,
        });
        testManager.onTestRunEnd({
          totalTestCount: 2,
          unhandledErrors: [],
        });
      },
    });

    expect(mockComponentTestStatusStore.set).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ storyId: 'story--one' })])
    );
    expect(mockComponentTestStatusStore.set).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ storyId: 'another--one' })])
    );
    expect(mockStore.getState().currentRun.totalTestCount).toBe(1);
  });

  it('should keep child test results when parent story is requested', async () => {
    const testManager = await TestManager.start(options);
    const passedResult = { state: 'passed', errors: [] } as unknown as TestResult;

    await testManager.runTestsWithState({
      storyIds: ['parent--story'],
      triggeredBy: 'global',
      callback: async () => {
        testManager.onTestCaseResult({
          storyId: 'parent--story:test',
          testResult: passedResult,
        });
        testManager.onTestRunEnd({
          totalTestCount: 1,
          unhandledErrors: [],
        });
      },
    });

    expect(mockComponentTestStatusStore.set).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ storyId: 'parent--story:test' })])
    );
    expect(mockStore.getState().currentRun.totalTestCount).toBe(1);
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
      Tag.TEST,
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

  it('should wait for the current run to finish before resolving cancel', async () => {
    vitest.globTestSpecifications.mockImplementation(() => tests);
    const runningTestRun = Promise.withResolvers<void>();
    vitest.runTestSpecifications.mockReturnValueOnce(runningTestRun.promise);

    const testManager = await TestManager.start(options);
    const triggerRunPromise = testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        triggeredBy: 'global',
      },
    });

    await vi.waitFor(() => {
      expect(vitest.runTestSpecifications).toHaveBeenCalledWith(tests, true);
    });

    let didCancelResolve = false;
    const cancelPromise = testManager.handleCancelEvent().then(() => {
      didCancelResolve = true;
    });

    await vi.waitFor(() => {
      expect(vitest.cancelCurrentRun).toHaveBeenCalledWith('keyboard-input');
    });

    await Promise.resolve();
    expect(didCancelResolve).toBe(false);

    runningTestRun.resolve();

    await triggerRunPromise;
    await cancelPromise;

    expect(didCancelResolve).toBe(true);
  });

  it('should reset the focused test pattern when Vitest cancels a run', async () => {
    vitest.globTestSpecifications.mockImplementation(() => tests);
    const runningTestRun = Promise.withResolvers<void>();
    vitest.runTestSpecifications.mockReturnValueOnce(runningTestRun.promise);

    const testManager = await TestManager.start(options);
    const triggerRunPromise = testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        storyIds: ['story--one'],
        triggeredBy: 'global',
      },
    });

    await vi.waitFor(() => {
      expect(setTestNamePattern).toHaveBeenCalledWith(new RegExp(`^One$`));
    });

    const onCancel = vitest.onCancel.mock.calls[0]?.[0];

    expect(onCancel).toBeTypeOf('function');

    setTestNamePattern.mockClear();
    onCancel();

    expect(setTestNamePattern).toHaveBeenCalledWith('');

    runningTestRun.resolve();
    await triggerRunPromise;
  });
});
