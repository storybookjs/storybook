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
import type { Report } from 'storybook/preview-api';

import {
  STATUS_TYPE_ID_A11Y,
  STATUS_TYPE_ID_COMPONENT_TEST,
  STORYBOOK_TEST_PROVIDE_KEY,
  storeOptions,
} from '../constants.ts';
import type { StoreEvent, StoreState } from '../types.ts';
import { TestManager, type TestManagerOptions } from './test-manager.ts';
import { DOUBLE_SPACES } from './vitest-manager.ts';

const setTestNamePattern = vi.hoisted(() => vi.fn());
const vitest = vi.hoisted(() => ({
  projects: [{ config: { env: {} }, matchesTestGlob: vi.fn(() => false) }] as any[],
  standalone: vi.fn(),
  init: vi.fn(),
  close: vi.fn(),
  onCancel: vi.fn(),
  logger: {
    clearHighlightCache: vi.fn(),
  },
  provide: vi.fn(),
  runTestSpecifications: vi.fn(),
  cancelCurrentRun: vi.fn(),
  enableCoverage: vi.fn(),
  disableCoverage: vi.fn(),
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

const mockVitestVersion = vi.hoisted(() => ({ value: '4.1.6' }));
const mockCreateVitest = vi.fn();

vi.mock('vitest/node', () => ({
  createVitest: mockCreateVitest,
  get version() {
    return mockVitestVersion.value;
  },
}));

// Use the mock function directly
const createVitest = mockCreateVitest;

beforeEach(() => {
  vi.clearAllMocks();
  mockVitestVersion.value = '4.1.6';
  mockStore.setState(() => storeOptions.initialState);
  vitest.projects = [{ config: { env: {} }, matchesTestGlob: vi.fn(() => false) }];
  vitest.config.coverage.enabled = false;
  createVitest.mockResolvedValue(vitest);
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

const mockStore = new experimental_MockUniversalStore<StoreState, StoreEvent>(storeOptions, vi);
const startWithIndex = async () => {
  const testManager = await TestManager.start(options);
  testManager.storyIndex = mockIndex;
  return testManager;
};

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
    project: {
      config: { env: { __STORYBOOK_URL__: 'http://localhost:6006' } },
    },
    moduleId: path.join(process.cwd(), 'path/to/file'),
  },
  {
    project: {
      config: { env: { __STORYBOOK_URL__: 'http://localhost:6006' } },
    },
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
  previewAnnotations: [],
};

describe('TestManager', () => {
  it('initializes Vitest without running tests', async () => {
    await TestManager.start(options);
    expect(vitest.standalone).toHaveBeenCalledOnce();
    expect(vitest.init).not.toHaveBeenCalled();
    expect(vitest.runTestSpecifications).not.toHaveBeenCalled();
  });

  it.each(['3.2.4', '4.0.0'])(
    'initializes Vitest %s without standalone or running tests',
    async (version) => {
      mockVitestVersion.value = version;
      const { standalone, ...legacyVitest } = vitest;
      createVitest.mockResolvedValue(legacyVitest);

      await TestManager.start(options);

      expect(legacyVitest.init).toHaveBeenCalledOnce();
      expect(standalone).not.toHaveBeenCalled();
      expect(legacyVitest.runTestSpecifications).not.toHaveBeenCalled();
    }
  );

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
    const testManager = await startWithIndex();

    expect(testManager).toBeInstanceOf(TestManager);
    expect(createVitest).toHaveBeenCalled();
  });

  it('should handle run request', async () => {
    vitest.globTestSpecifications.mockImplementation(() => tests);
    const testManager = await startWithIndex();
    expect(createVitest).toHaveBeenCalledTimes(1);

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        triggeredBy: 'global',
      },
    });
    expect(createVitest).toHaveBeenCalledTimes(1);
    expect(vitest.provide).toHaveBeenCalledWith(STORYBOOK_TEST_PROVIDE_KEY, {
      coverage: false,
      a11y: false,
    });
    expect(vitest.runTestSpecifications).toHaveBeenCalledWith(tests, true);
  });

  describe('story files Vitest has not picked up yet', () => {
    // A story file created outside the Vite root after startup: Storybook indexes it, but Vitest's
    // cached test file list doesn't contain it because its watcher never reported the file.
    const newFile = path.join(process.cwd(), 'path/to/new/file');
    const indexWithNewFile = {
      ...mockIndex,
      entries: {
        ...mockIndex.entries,
        'new--story': {
          type: 'story',
          subtype: 'story',
          id: 'new--story',
          name: 'Story',
          title: 'new',
          importPath: 'path/to/new/file',
          tags: [Tag.TEST],
        },
      },
    } as StoryIndex;

    /** A project that, like Vitest's, adds matching files to its cached test file list. */
    const createProject = (
      env: Record<string, string>,
      {
        initialFiles = [],
        matches = () => true,
      }: { initialFiles?: string[]; matches?: (moduleId: string) => boolean } = {}
    ) => {
      const files = new Set(initialFiles);
      const project: any = {
        config: { env, root: process.cwd(), setupFiles: [] },
        files,
        matchesTestGlob: vi.fn((moduleId: string) => {
          if (files.has(moduleId)) {
            return true;
          }
          if (!matches(moduleId)) {
            return false;
          }
          files.add(moduleId);
          return true;
        }),
        vite: {
          moduleGraph: {
            getModuleById: vi.fn(),
            getModulesByFile: vi.fn(() => []),
            invalidateModule: vi.fn(),
          },
          transformRequest: vi.fn(),
        },
      };
      return project;
    };
    const storybookEnv = { __STORYBOOK_URL__: 'http://localhost:6006' };
    const knownFiles = tests.map((test) => test.moduleId);

    const useProjects = (...projects: any[]) => {
      vitest.projects = projects;
      // One spec per project and file, like Vitest's own globTestSpecifications
      vitest.globTestSpecifications.mockImplementation(() =>
        projects.flatMap((project) =>
          [...project.files].map((moduleId: string) => ({ project, moduleId }))
        )
      );
    };

    it('runs a story file that was added to the index after startup', async () => {
      const project = createProject(storybookEnv, { initialFiles: knownFiles });
      useProjects(project);
      const testManager = await startWithIndex();

      testManager.storyIndex = indexWithNewFile;
      expect(project.matchesTestGlob).toHaveBeenCalledWith(newFile);

      await testManager.handleTriggerRunEvent({
        type: 'TRIGGER_RUN',
        payload: { storyIds: ['story--one', 'new--story'], triggeredBy: 'global' },
      });

      expect(vitest.runTestSpecifications).toHaveBeenCalledWith(
        [
          { project, moduleId: knownFiles[0] },
          { project, moduleId: newFile },
        ],
        true
      );
    });

    it('registers the new file with every Storybook project, not just the first one', async () => {
      // The file is already cached by the first Storybook project and by a non-Storybook project
      const first = createProject(storybookEnv, { initialFiles: [...knownFiles, newFile] });
      const second = createProject(storybookEnv, { initialFiles: knownFiles });
      const other = createProject({}, { initialFiles: [newFile] });
      useProjects(first, second, other);
      const testManager = await startWithIndex();

      testManager.storyIndex = indexWithNewFile;
      expect(other.matchesTestGlob).not.toHaveBeenCalled();

      await testManager.handleTriggerRunEvent({
        type: 'TRIGGER_RUN',
        payload: { storyIds: ['new--story'], triggeredBy: 'global' },
      });

      expect(vitest.runTestSpecifications).toHaveBeenCalledWith(
        [
          { project: first, moduleId: newFile },
          { project: second, moduleId: newFile },
        ],
        true
      );
    });

    it('does not run an indexed file that the Vitest test globs exclude', async () => {
      const project = createProject(storybookEnv, {
        initialFiles: knownFiles,
        matches: (moduleId) => moduleId !== newFile,
      });
      useProjects(project);
      const testManager = await startWithIndex();

      testManager.storyIndex = indexWithNewFile;

      await testManager.handleTriggerRunEvent({
        type: 'TRIGGER_RUN',
        payload: { storyIds: ['new--story'], triggeredBy: 'global' },
      });

      expect(vitest.runTestSpecifications).toHaveBeenCalledWith([], true);
    });

    it('keeps going when checking one file against the test globs throws', async () => {
      const project = createProject(storybookEnv, { initialFiles: knownFiles });
      const matchesTestGlob = project.matchesTestGlob;
      project.matchesTestGlob = vi.fn((moduleId: string) => {
        if (moduleId === newFile) {
          throw new Error('ENOENT: no such file or directory');
        }
        return matchesTestGlob(moduleId);
      });
      useProjects(project);
      const testManager = await startWithIndex();

      expect(() => {
        testManager.storyIndex = indexWithNewFile;
      }).not.toThrow();

      await testManager.handleTriggerRunEvent({
        type: 'TRIGGER_RUN',
        payload: { storyIds: ['story--one', 'new--story'], triggeredBy: 'global' },
      });

      expect(vitest.runTestSpecifications).toHaveBeenCalledWith(
        [{ project, moduleId: knownFiles[0] }],
        true
      );
    });

    it('includes the new file when a watch-mode change reruns all tests', async () => {
      const previewFile = path.join(process.cwd(), '.storybook/preview.ts');
      const project = createProject(storybookEnv, { initialFiles: knownFiles });
      useProjects(project);
      const testManager = await TestManager.start({
        ...options,
        previewAnnotations: [previewFile],
      });
      testManager.storyIndex = mockIndex;
      mockStore.setState((s) => ({ ...s, watching: true }));
      vi.spyOn(testManager.vitestManager as any, 'getTestDependencies').mockResolvedValue(
        new Set()
      );

      testManager.storyIndex = indexWithNewFile;
      // Changing a preview annotation affects every story, so all tests rerun
      await testManager.vitestManager.runAffectedTestsAfterChange(previewFile, 'change');

      expect(vitest.runTestSpecifications).toHaveBeenLastCalledWith(
        expect.arrayContaining([{ project, moduleId: newFile }]),
        false
      );
    });
  });
  it('should provide merged config override before running tests', async () => {
    vitest.globTestSpecifications.mockImplementation(() => tests);
    const testManager = await startWithIndex();

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        triggeredBy: 'external:actor',
        configOverride: {
          coverage: false,
          a11y: true,
          customFlag: 'custom-value',
        },
      },
    });

    expect(vitest.provide).toHaveBeenLastCalledWith(STORYBOOK_TEST_PROVIDE_KEY, {
      coverage: false,
      a11y: true,
      customFlag: 'custom-value',
    });
  });

  it('should refresh provided config before watch-triggered reruns', async () => {
    vitest.globTestSpecifications.mockImplementation(() => tests);
    vitest.projects = [
      {
        config: {
          env: { __STORYBOOK_URL__: 'http://localhost:6006' },
          root: process.cwd(),
          setupFiles: [],
        },
        matchesTestGlob: vi.fn(),
        vite: {
          moduleGraph: {
            getModuleById: vi.fn(),
            getModulesByFile: vi.fn(() => []),
            invalidateModule: vi.fn(),
          },
          transformRequest: vi.fn(),
        },
      },
    ] as any;

    const testManager = await startWithIndex();

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        triggeredBy: 'global',
      },
    });

    vitest.provide.mockClear();
    mockStore.setState((s) => ({
      ...s,
      watching: true,
      config: { coverage: false, a11y: true },
    }));

    vi.spyOn(testManager.vitestManager as any, 'getTestDependencies').mockResolvedValue(new Set());

    await testManager.vitestManager.runAffectedTestsAfterChange(tests[0].moduleId, 'change');

    expect(vitest.provide).toHaveBeenCalledWith(STORYBOOK_TEST_PROVIDE_KEY, {
      coverage: false,
      a11y: true,
    });
    expect(vitest.runTestSpecifications).toHaveBeenLastCalledWith(tests.slice(0, 1), false);
  });

  it('should persist all reports on TEST_RUN_COMPLETED without writing them into currentRun', async () => {
    const testManager = await startWithIndex();
    const passedResult = {
      state: 'passed',
      errors: [],
    } as unknown as TestResult;

    await testManager.runTestsWithState({
      storyIds: ['story--one'],
      triggeredBy: 'global',
      callback: async () => {
        testManager.onTestCaseResult({
          storyId: 'story--one',
          testResult: passedResult,
          reports: [
            {
              type: 'a11y',
              status: 'passed',
              result: { id: 'a11y-report' },
            } as Report,
            {
              type: 'custom',
              status: 'passed',
              result: { id: 'custom-report' },
            } as Report,
          ],
        });
        testManager.onTestRunEnd({
          totalTestCount: 1,
          unhandledErrors: [],
        });
      },
    });

    const completed = vi
      .mocked(mockStore.send)
      .mock.calls.find(([event]) => event.type === 'TEST_RUN_COMPLETED');
    expect(completed?.[0]).toEqual(
      expect.objectContaining({
        type: 'TEST_RUN_COMPLETED',
        payload: expect.objectContaining({
          reports: {
            'story--one': [
              { type: 'a11y', status: 'passed', result: { id: 'a11y-report' } },
              { type: 'custom', status: 'passed', result: { id: 'custom-report' } },
            ],
          },
        }),
      })
    );
    expect(mockStore.getState().currentRun.reports).toEqual({});
  });

  it('keeps per-flush synced state bounded and materializes full results at run end', async () => {
    const testManager = await startWithIndex();
    const passedResult = {
      state: 'passed',
      errors: [],
    } as unknown as TestResult;

    await testManager.runTestsWithState({
      storyIds: ['story--one', 'story--two'],
      triggeredBy: 'global',
      callback: async () => {
        testManager.onTestCaseResult({
          storyId: 'story--one',
          testResult: passedResult,
          reports: [{ type: 'a11y', status: 'passed', result: { id: 'a11y-1' } } as Report],
        });
        testManager.throttledFlushTestCaseResults.flush();

        expect(mockStore.getState().currentRun.componentTestStatuses).toHaveLength(0);
        expect(mockStore.getState().currentRun.a11yStatuses).toHaveLength(0);
        expect(mockStore.getState().currentRun.reports).toEqual({});
        expect(mockStore.getState().currentRun.a11yReports).toEqual({});
        expect(mockStore.getState().currentRun.componentTestCount.success).toBe(1);

        testManager.onTestCaseResult({
          storyId: 'story--two',
          testResult: passedResult,
        });
        testManager.throttledFlushTestCaseResults.flush();

        expect(mockStore.getState().currentRun.componentTestStatuses).toHaveLength(0);
        expect(mockStore.getState().currentRun.componentTestCount.success).toBe(2);

        testManager.onTestRunEnd({ totalTestCount: 2, unhandledErrors: [] });
      },
    });

    const { currentRun } = mockStore.getState();
    expect(currentRun.componentTestStatuses).toHaveLength(0);
    expect(currentRun.a11yStatuses).toHaveLength(0);
    expect(currentRun.reports).toEqual({});
    expect(currentRun.a11yReports).toEqual({});

    const completed = vi
      .mocked(mockStore.send)
      .mock.calls.find(([event]) => event.type === 'TEST_RUN_COMPLETED');
    expect(completed?.[0]).toEqual(
      expect.objectContaining({
        type: 'TEST_RUN_COMPLETED',
        payload: expect.objectContaining({
          componentTestStatuses: [
            expect.objectContaining({ storyId: 'story--one' }),
            expect.objectContaining({ storyId: 'story--two' }),
          ],
          a11yStatuses: [expect.objectContaining({ storyId: 'story--one' })],
          reports: { 'story--one': [expect.objectContaining({ type: 'a11y' })] },
          a11yReports: { 'story--one': [{ id: 'a11y-1' }] },
        }),
      })
    );
  });

  it('should describe failures with the source-mapped frames rather than the raw browser stack', async () => {
    const testManager = await startWithIndex();
    const failedResult = {
      state: 'failed',
      errors: [
        {
          message:
            '\n\x1B[34mClick to debug the error directly in Storybook: http://localhost:6006/?path=/story/story--one\x1B[39m\n\nexpect(element).toBeInTheDocument()',
          stack:
            'Error: expect(element).toBeInTheDocument()\n    at Proxy.expectWrapper (http://localhost:6006/deps/storybook_test.js?v=8c5dc1d5:13691:16)',
          stacks: [
            {
              method: 'toBeInTheDocument',
              file: '/project/src/stories/Page.stories.ts',
              line: 30,
              column: 60,
            },
          ],
        },
      ],
    } as unknown as TestResult;

    await testManager.runTestsWithState({
      storyIds: ['story--one'],
      triggeredBy: 'global',
      callback: async () => {
        testManager.onTestCaseResult({ storyId: 'story--one', testResult: failedResult });
        testManager.onTestRunEnd({ totalTestCount: 1, unhandledErrors: [] });
      },
    });

    expect(mockComponentTestStatusStore.set).toHaveBeenCalledWith([
      expect.objectContaining({
        storyId: 'story--one',
        description:
          'expect(element).toBeInTheDocument()\n    at toBeInTheDocument (/project/src/stories/Page.stories.ts:30:60)',
      }),
    ]);
  });

  it('should filter tests', async () => {
    vitest.globTestSpecifications.mockImplementation(() => tests);
    const testManager = await startWithIndex();

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
    const testManager = await startWithIndex();

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

  it.each([
    ['4.1.6', ' '],
    ['5.0.0', ' > '],
  ])('should trigger a single story test with Vitest %s', async (version, separator) => {
    mockVitestVersion.value = version;
    vitest.globTestSpecifications.mockImplementation(() => tests);
    const testManager = await startWithIndex();

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        storyIds: ['parent--story:test'],
        triggeredBy: 'global',
      },
    });
    // regex should be Parent Story Name + Test Name
    expect(setTestNamePattern).toHaveBeenCalledWith(
      new RegExp(`^Parent story${DOUBLE_SPACES}${separator}Test name$`)
    );
  });

  it('should trigger all tests of a story', async () => {
    vitest.globTestSpecifications.mockImplementation(() => tests);
    const testManager = await startWithIndex();

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
    const testManager = await startWithIndex();

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

  // SB-2557: Svelte CSF compiles stories to `export { $__X as X }`, so their tests are named after
  // the export (`HoverShowsFullDate`) while the index has the display name.
  it('matches a story by its name or its export name', async () => {
    vitest.globTestSpecifications.mockImplementation(() => tests);
    const testManager = await startWithIndex();
    testManager.storyIndex = {
      v: 5,
      entries: {
        'timestamp--hover-shows-full-date': {
          type: 'story',
          subtype: 'story',
          id: 'timestamp--hover-shows-full-date',
          name: 'Hover Shows Full Date',
          exportName: 'HoverShowsFullDate',
          title: 'timestamp',
          importPath: 'path/to/file',
          tags: [Tag.TEST],
        },
        'timestamp--today': {
          type: 'story',
          subtype: 'story',
          id: 'timestamp--today',
          name: 'Today',
          exportName: 'Today',
          title: 'timestamp',
          importPath: 'path/to/file',
          tags: [Tag.TEST],
        },
        'timestamp--from-a-string': {
          type: 'story',
          subtype: 'story',
          id: 'timestamp--from-a-string',
          name: 'From A String',
          exportName: 'FromAString',
          title: 'timestamp',
          importPath: 'path/to/file',
          tags: [Tag.TEST],
        },
      },
    } as StoryIndex;

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        storyIds: ['timestamp--hover-shows-full-date', 'timestamp--today'],
        triggeredBy: 'global',
      },
    });

    const regex = setTestNamePattern.mock.calls.find(([arg]) => arg instanceof RegExp)?.[0] as
      | RegExp
      | undefined;

    expect(regex?.test('HoverShowsFullDate')).toBe(true);
    expect(regex?.test('Hover Shows Full Date')).toBe(true);
    expect(regex?.test('Today')).toBe(true);
    expect(regex?.test('FromAString')).toBe(false);
    expect(regex?.test('From A String')).toBe(false);
  });

  it('records which selected stories tags or the Vitest project leave out', async () => {
    // Only the first story file is a test file of the Vitest project.
    vitest.globTestSpecifications.mockImplementation(() => tests.slice(0, 1));
    const testManager = await startWithIndex();
    testManager.storyIndex = {
      ...mockIndex,
      entries: {
        ...mockIndex.entries,
        // Without the `test` tag, the default include filter keeps it out.
        'story--two': { ...mockIndex.entries['story--two'], tags: ['dev'] },
      },
    } as StoryIndex;

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        storyIds: ['story--one', 'story--two', 'another--one'],
        triggeredBy: 'global',
      },
    });

    expect(mockStore.getState().currentRun.excludedStoryIds).toEqual({
      byTags: ['story--two'],
      notInProject: ['another--one'],
    });
  });

  it('should trigger only selected stories across multiple files', async () => {
    vitest.globTestSpecifications.mockImplementation(() => tests);
    const testManager = await startWithIndex();

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
    const testManager = await startWithIndex();
    const passedResult = {
      state: 'passed',
      errors: [],
    } as unknown as TestResult;

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
    const testManager = await startWithIndex();
    const passedResult = {
      state: 'passed',
      errors: [],
    } as unknown as TestResult;

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

  it('should enable coverage without restarting Vitest before a test run', async () => {
    const testManager = await startWithIndex();
    expect(createVitest).toHaveBeenCalledTimes(1);
    expect(createVitest).toHaveBeenCalledWith(
      Tag.TEST,
      expect.objectContaining({
        coverage: expect.objectContaining({ enabled: false, reportsDirectory: expect.any(String) }),
      })
    );
    createVitest.mockClear();

    mockStore.setState((s) => ({
      ...s,
      config: { coverage: true, a11y: false },
    }));

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        triggeredBy: 'global',
      },
    });

    expect(createVitest).not.toHaveBeenCalled();
    expect(vitest.close).not.toHaveBeenCalled();
    expect(vitest.enableCoverage).toHaveBeenCalledTimes(1);
    expect(vitest.enableCoverage.mock.invocationCallOrder[0]).toBeGreaterThan(
      vitest.cancelCurrentRun.mock.invocationCallOrder[0]
    );
    expect(vitest.runTestSpecifications).toHaveBeenCalledTimes(1);

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        triggeredBy: 'global',
      },
    });

    expect(vitest.enableCoverage).toHaveBeenCalledTimes(1);
  });

  it('should disable coverage without restarting Vitest when coverage is turned off', async () => {
    const testManager = await startWithIndex();
    mockStore.setState((s) => ({
      ...s,
      config: { coverage: true, a11y: false },
    }));
    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: { triggeredBy: 'global' },
    });
    createVitest.mockClear();

    mockStore.setState((s) => ({
      ...s,
      config: { coverage: false, a11y: false },
    }));
    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: { triggeredBy: 'global' },
    });

    expect(createVitest).not.toHaveBeenCalled();
    expect(vitest.disableCoverage).toHaveBeenCalledTimes(1);
  });

  it('should not restart with coverage enabled Vitest before a focused test run', async () => {
    const testManager = await startWithIndex();
    expect(createVitest).toHaveBeenCalledTimes(1);
    createVitest.mockClear();

    mockStore.setState((s) => ({
      ...s,
      config: { coverage: true, a11y: false },
    }));

    await testManager.handleTriggerRunEvent({
      type: 'TRIGGER_RUN',
      payload: {
        storyIds: ['story--one'],
        triggeredBy: 'global',
      },
    });

    expect(createVitest).not.toHaveBeenCalled();
    expect(vitest.enableCoverage).not.toHaveBeenCalled();
  });
});
