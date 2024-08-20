import { existsSync } from 'node:fs';

import { coverageConfigDefaults } from 'vitest/config';
import type { Vitest, WorkspaceProject, WorkspaceSpec } from 'vitest/node';
import { slash } from 'vitest/utils';

import type { Channel } from 'storybook/internal/channels';

import { COVERAGE_IN_PROGRESS, FILE_CHANGED_EVENT } from '../constants';
import type { CoverageState, ManagerState, TestingMode } from '../types';
import type { CoverageManager } from './coverage-manager';
import type { CoverageReporterOptions } from './coverage-reporter';

export class VitestManager {
  vitest: Vitest | null = null;

  constructor(
    private channel: Channel,
    private managerState: ManagerState,
    private coverageState: CoverageState,
    private coverageManager: CoverageManager
  ) {}

  private async getTestDependencies(filepath: WorkspaceSpec, deps = new Set<string>()) {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const addImports = async ([project, filepath]: WorkspaceSpec) => {
      if (deps.has(filepath)) {
        return;
      }
      deps.add(filepath);

      const mod = project.server.moduleGraph.getModuleById(filepath);
      const transformed =
        mod?.ssrTransformResult || (await project.vitenode.transformRequest(filepath));
      if (!transformed) {
        return;
      }
      const dependencies = [...(transformed.deps || []), ...(transformed.dynamicDeps || [])];
      await Promise.all(
        dependencies.map(async (dep) => {
          const path = await project.server?.pluginContainer.resolveId(dep, filepath, {
            ssr: true,
          });
          const fsPath = path && !path.external && path.id.split('?')[0];
          if (
            fsPath &&
            !fsPath.includes('node_modules') &&
            !deps.has(fsPath) &&
            existsSync(fsPath)
          ) {
            await addImports([project, fsPath]);
          }
        })
      );
    };

    await addImports(filepath);
    deps.delete(filepath[1]);

    return deps;
  }

  async startVitest() {
    const { createVitest } = await import('vitest/node');
    const start = performance.now();

    const mode = this.managerState.mode!;

    this.vitest = await createVitest(
      'test',
      {
        watch: true,
        passWithNoTests: true,
        changed: mode.coverageType === 'project-coverage',
        coverage: {
          reportOnFailure: true,
          reporter: [
            [
              require.resolve('@storybook/experimental-addon-coverage/coverage-reporter'),
              {
                channel: this.channel,
                coverageState: this.coverageState,
                coverageManager: this.coverageManager,
              } satisfies CoverageReporterOptions,
            ],
          ],
          provider: mode.coverageProvider,
          enabled: true,
          exclude: [
            ...coverageConfigDefaults.exclude,
            '**/*.stories.ts',
            '**/*.stories.tsx',
            '**/__mocks/**',
            '**/dist/**',
            'playwright.config.ts',
            'vitest-setup.ts',
            'vitest.helpers.ts',
          ],
          all: false,
        },
      },
      {
        cacheDir: 'node_modules/.storybook-addon-coverage/.vite',
      }
    );

    if (!this.vitest || this.vitest.projects.length < 1) {
      return;
    }

    this.emitCoverageStart(start);

    const absoluteComponentPath = this.managerState.absoluteComponentPath!;

    await this.vitest.init();
    await this.setupWatchers();
    await this.runAffectedTests();

    this.vitest.server.watcher.on('change', (file) => {
      if (file === absoluteComponentPath) {
        this.channel.emit(FILE_CHANGED_EVENT, absoluteComponentPath);
      }
    });
  }

  getStorybookProjects() {
    return this.vitest?.projects.filter((project) => this.isStorybookProject(project)) ?? [];
  }

  isStorybookProject(project: WorkspaceProject) {
    // eslint-disable-next-line no-underscore-dangle
    return !!project.config.env?.__STORYBOOK_URL__;
  }

  async runAffectedTests(trigger?: string) {
    if (!this.vitest) return;
    const start = performance.now();

    const absoluteStoryPath = this.managerState.absoluteStoryPath!;
    const absoluteComponentPath = this.managerState.absoluteComponentPath!;

    const globTestFiles = await this.vitest.globTestFiles();
    const testGraphs = await Promise.all(
      globTestFiles
        .filter(([project]) => this.isStorybookProject(project))
        .map(async (spec) => {
          const deps = await this.getTestDependencies(spec);
          return [spec, deps] as const;
        })
    );
    const componentAffectedTests: WorkspaceSpec[] = [];
    const triggerAffectedTests: WorkspaceSpec[] = [];

    if (this.managerState.mode?.coverageType === 'component-coverage') {
      for (const project of this.getStorybookProjects()) {
        componentAffectedTests.push([project, absoluteStoryPath] as const);
      }

      for (const [filepath, deps] of testGraphs) {
        if (trigger && (trigger === filepath[1] || deps.has(trigger))) {
          triggerAffectedTests.push(filepath);
        }
      }
    } else {
      for (const [filepath, deps] of testGraphs) {
        if (absoluteComponentPath === filepath[1] || deps.has(absoluteComponentPath)) {
          componentAffectedTests.push(filepath);
        }
        if (trigger && (trigger === filepath[1] || deps.has(trigger))) {
          triggerAffectedTests.push(filepath);
        }
      }
    }

    const hasTriggerEffectOnTests = triggerAffectedTests.some(
      ([_, path]) => path === absoluteStoryPath
    );

    if (!trigger || hasTriggerEffectOnTests) {
      this.emitCoverageStart(start);
      await this.vitest.cancelCurrentRun('keyboard-input');
      await this.vitest.runFiles(componentAffectedTests, true);
    }
  }

  private emitCoverageStart(time = performance.now()) {
    this.coverageState.timeStartTesting = time;
    this.channel.emit(COVERAGE_IN_PROGRESS);
  }

  private updateLastChanged(filepath: string) {
    const projects = this.vitest!.getModuleProjects(filepath);
    projects.forEach(({ server, browser }) => {
      const serverMods = server.moduleGraph.getModulesByFile(filepath);
      serverMods?.forEach((mod) => server.moduleGraph.invalidateModule(mod));

      if (browser) {
        const browserMods = browser.vite.moduleGraph.getModulesByFile(filepath);
        browserMods?.forEach((mod) => browser.vite.moduleGraph.invalidateModule(mod));
      }
    });
  }

  async runAffectedTestsAfterChange(file: string) {
    const id = slash(file);
    this.vitest?.logger.clearHighlightCache(id);
    this.updateLastChanged(id);

    await this.runAffectedTests(file);
  }

  async setupWatchers() {
    this.vitest?.server.watcher.removeAllListeners('change');
    this.vitest?.server.watcher.removeAllListeners('add');
    this.vitest?.server.watcher.on('change', this.runAffectedTestsAfterChange.bind(this));
    this.vitest?.server.watcher.on('add', this.runAffectedTestsAfterChange.bind(this));
  }

  async closeVitest() {
    if (this.vitest) {
      await this.vitest.close();
    }
  }

  isVitestRunning() {
    return !!this.vitest;
  }
}
