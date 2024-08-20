import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Vitest, createVitest } from 'vitest/node';

import type { Channel } from 'storybook/internal/channels';

import type { CoverageState, ManagerState, TestingMode } from '../types';
import type { CoverageManager } from './coverage-manager';
import { VitestManager } from './vitest-manager';

vi.mock(import('vitest/node'), async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    createVitest: vi.fn().mockResolvedValue({
      projects: [{}],
      start: vi.fn(),
      init: vi.fn(),
      globTestFiles: vi.fn(() => [
        [
          {
            config: {
              env: {
                __STORYBOOK_URL__: 'http://localhost:6006',
              },
            },
            server: {
              moduleGraph: {
                getModuleById: vi.fn(() => ({
                  ssrTransformResult: {
                    deps: ['src/test.ts'],
                  },
                })),
              },
              pluginContainer: {
                resolveId: vi.fn(() => ({
                  id: 'src/test.ts',
                })),
              },
            },
          },
        ],
      ]),
      runFiles: vi.fn(),
      server: {
        watcher: {
          on: vi.fn(),
          removeAllListeners: vi.fn(),
        },
      },
    }),
  };
});

describe('VitestManager', () => {
  let channel: Channel;
  let managerState: ManagerState;
  let coverageState: CoverageState;
  let coverageManager: CoverageManager;
  let vitestManager: VitestManager;

  beforeEach(() => {
    channel = {
      emit: vi.fn(),
    } as unknown as Channel;

    managerState = {
      coverageType: 'project-coverage',
      absoluteComponentPath: '',
    } as ManagerState;

    coverageState = {
      timeStartTesting: 0,
    } as CoverageState;

    coverageManager = {} as CoverageManager;

    vitestManager = new VitestManager(channel, managerState, coverageState, coverageManager);
  });

  it('should initialize Vitest', async () => {
    await vitestManager.initVitest({
      importPath: 'src/component.ts',
      componentPath: 'src/component.ts',
      absoluteComponentPath: '/absolute/path/to/component.ts',
      mode: {
        coverageType: 'project-coverage',
        coverageProvider: 'v8',
        browser: false,
      } as TestingMode,
    });

    expect(createVitest).toHaveBeenCalled();
    expect(vitestManager.isVitestRunning()).toBe(true);
  });

  it('should run affected tests', async () => {
    await vitestManager.initVitest({
      importPath: 'src/component.ts',
      componentPath: 'src/component.ts',
      absoluteComponentPath: '/absolute/path/to/component.ts',
      mode: {
        coverageType: 'project-coverage',
        coverageProvider: 'v8',
        browser: false,
      } as TestingMode,
    });

    const absoluteComponentPath = 'src/component.ts';
    await vitestManager.runAffectedTests(absoluteComponentPath);

    expect(vitestManager.vitest?.runFiles).toHaveBeenCalled();
  });

  it('should handle file change', async () => {
    vitestManager.vitest = {
      logger: {
        clearHighlightCache: vi.fn(),
      },
      getModuleProjects: vi.fn().mockReturnValue([
        {
          server: {
            moduleGraph: {
              getModulesByFile: vi.fn().mockReturnValue([]),
              invalidateModule: vi.fn(),
            },
          },
        },
      ]),
    } as unknown as Vitest;

    const file = 'src/component.ts';
    await vitestManager.runAffectedTestsAfterChange(file);

    expect(vitestManager.vitest?.logger.clearHighlightCache).toHaveBeenCalledWith(file);
  });

  it('should close Vitest', async () => {
    vitestManager.vitest = {
      close: vi.fn(),
    } as unknown as Vitest;

    await vitestManager.closeVitest();

    expect(vitestManager.vitest?.close).toHaveBeenCalled();
  });

  it('should check if Vitest is running', () => {
    vitestManager.vitest = null;
    expect(vitestManager.isVitestRunning()).toBe(false);

    vitestManager.vitest = {} as Vitest;
    expect(vitestManager.isVitestRunning()).toBe(true);
  });
});
