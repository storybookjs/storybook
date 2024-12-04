import { existsSync } from 'node:fs';

import type {
  CoverageOptions,
  ResolvedCoverageOptions,
  TestProject,
  TestSpecification,
  Vitest,
  WorkspaceProject,
} from 'vitest/node';

import { resolvePathInStorybookCache } from 'storybook/internal/common';
import type { TestingModuleRunRequestPayload } from 'storybook/internal/core-events';

import type { DocsIndexEntry, StoryIndex, StoryIndexEntry } from '@storybook/types';

import path, { normalize } from 'pathe';
import slash from 'slash';

import { COVERAGE_DIRECTORY, type Config } from '../constants';
import { log } from '../logger';
import type { StorybookCoverageReporterOptions } from './coverage-reporter';
import { StorybookReporter } from './reporter';
import type { TestManager } from './test-manager';

type TagsFilter = {
  include: string[];
  exclude: string[];
  skip: string[];
};

export class VitestManager {
  vitest: Vitest | null = null;

  vitestStartupCounter = 0;

  storyCountForCurrentRun: number = 0;

  constructor(private testManager: TestManager) {}

  async startVitest({ watchMode = false, coverage = false } = {}) {
    const { createVitest } = await import('vitest/node');

    const storybookCoverageReporter: [string, StorybookCoverageReporterOptions] = [
      '@storybook/experimental-addon-test/internal/coverage-reporter',
      {
        testManager: this.testManager,
        coverageOptions: this.vitest?.config?.coverage as ResolvedCoverageOptions<'v8'>,
      },
    ];
    const coverageOptions = (
      coverage
        ? {
            enabled: true,
            clean: false,
            cleanOnRerun: !watchMode,
            reportOnFailure: true,
            exclude: [...(this.vitest?.config?.coverage?.exclude || []), '**/*.stories.*'],
            reporter: [['html', {}], storybookCoverageReporter],
            reportsDirectory: resolvePathInStorybookCache(COVERAGE_DIRECTORY),
          }
        : { enabled: false }
    ) as CoverageOptions;

    this.vitest = await createVitest('test', {
      watch: watchMode,
      passWithNoTests: false,
      changed: watchMode,
      // TODO:
      // Do we want to enable Vite's default reporter?
      // The output in the terminal might be too spamy and it might be better to
      // find a way to just show errors and warnings for example
      // Otherwise it might be hard for the user to discover Storybook related logs
      reporters: ['default', new StorybookReporter(this.testManager)],
      coverage: coverageOptions,
    });

    if (this.vitest) {
      this.vitest.onCancel(() => {
        // TODO: handle cancellation
      });
    }

    try {
      await this.vitest.init();
    } catch (e) {
      this.testManager.reportFatalError('Failed to init Vitest', e);
    }

    if (watchMode) {
      await this.setupWatchers();
    }
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

  private async fetchStories(indexUrl: string, requestStoryIds?: string[]) {
    try {
      const index = (await Promise.race([
        fetch(indexUrl).then((res) => res.json()),
        new Promise((_, reject) => setTimeout(reject, 3000, new Error('Request took too long'))),
      ])) as StoryIndex;
      const storyIds = requestStoryIds || Object.keys(index.entries);
      return storyIds.map((id) => index.entries[id]).filter((story) => story.type === 'story');
    } catch (e) {
      log('Failed to fetch story index: ' + e.message);
      return [];
    }
  }

  private filterStories(
    story: StoryIndexEntry | DocsIndexEntry,
    moduleId: string,
    tagsFilter: TagsFilter
  ) {
    const absoluteImportPath = path.join(process.cwd(), story.importPath);
    if (absoluteImportPath !== moduleId) {
      return false;
    }
    if (tagsFilter.include.length && !tagsFilter.include.some((tag) => story.tags?.includes(tag))) {
      return false;
    }
    if (tagsFilter.exclude.some((tag) => story.tags?.includes(tag))) {
      return false;
    }
    // Skipped tests are intentionally included here
    return true;
  }

  async runTests(requestPayload: TestingModuleRunRequestPayload<Config>) {
    if (!this.vitest) {
      await this.startVitest();
    }

    this.resetTestNamePattern();

    const stories = await this.fetchStories(requestPayload.indexUrl, requestPayload.storyIds);
    const vitestTestSpecs = await this.getStorybookTestSpecs();
    const isSingleStoryRun = requestPayload.storyIds?.length === 1;

    const { filteredTestFiles, totalTestCount } = vitestTestSpecs.reduce(
      (acc, spec) => {
        /* eslint-disable no-underscore-dangle */
        const { env = {} } = spec.project.config;
        const include = env.__VITEST_INCLUDE_TAGS__?.split(',').filter(Boolean) ?? ['test'];
        const exclude = env.__VITEST_EXCLUDE_TAGS__?.split(',').filter(Boolean) ?? [];
        const skip = env.__VITEST_SKIP_TAGS__?.split(',').filter(Boolean) ?? [];
        /* eslint-enable no-underscore-dangle */

        const matches = stories.filter((story) =>
          this.filterStories(story, spec.moduleId, { include, exclude, skip })
        );
        if (matches.length) {
          if (!this.testManager.watchMode) {
            // Clear the file cache if watch mode is not enabled
            this.updateLastChanged(spec.moduleId);
          }
          acc.filteredTestFiles.push(spec);
          acc.totalTestCount += matches.filter(
            // Don't count skipped stories, because StorybookReporter doesn't include them either
            (story) => !skip.some((tag) => story.tags?.includes(tag))
          ).length;
        }
        return acc;
      },
      { filteredTestFiles: [] as TestSpecification[], totalTestCount: 0 }
    );

    await this.cancelCurrentRun();
    this.storyCountForCurrentRun = totalTestCount;

    if (isSingleStoryRun) {
      const storyName = stories[0].name;
      this.vitest!.configOverride.testNamePattern = new RegExp(
        `^${storyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
      );
    }

    await this.vitest!.runFiles(filteredTestFiles, true);
    this.resetTestNamePattern();
  }

  async cancelCurrentRun() {
    await this.vitest?.cancelCurrentRun('keyboard-input');
    await this.vitest?.runningPromise;
  }

  async closeVitest() {
    await this.vitest?.close();
  }

  async getStorybookTestSpecs() {
    const globTestSpecs = (await this.vitest?.globTestSpecs()) ?? [];
    return (
      globTestSpecs.filter((workspaceSpec) => this.isStorybookProject(workspaceSpec.project)) ?? []
    );
  }

  private async getTestDependencies(spec: TestSpecification, deps = new Set<string>()) {
    const addImports = async (project: WorkspaceProject, filepath: string) => {
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
          const idPath = await project.server.pluginContainer.resolveId(dep, filepath, {
            ssr: true,
          });
          const fsPath = idPath && !idPath.external && idPath.id.split('?')[0];
          if (
            fsPath &&
            !fsPath.includes('node_modules') &&
            !deps.has(fsPath) &&
            existsSync(fsPath)
          ) {
            await addImports(project, fsPath);
          }
        })
      );
    };

    await addImports(spec.project.workspaceProject, spec.moduleId);
    deps.delete(spec.moduleId);

    return deps;
  }

  async runAffectedTests(trigger: string) {
    if (!this.vitest) {
      return;
    }
    this.resetTestNamePattern();

    const globTestFiles = await this.vitest.globTestSpecs();
    const testGraphs = await Promise.all(
      globTestFiles
        .filter((workspace) => this.isStorybookProject(workspace.project))
        .map(async (spec) => {
          const deps = await this.getTestDependencies(spec);
          return [spec, deps] as const;
        })
    );
    const triggerAffectedTests: TestSpecification[] = [];

    for (const [workspaceSpec, deps] of testGraphs) {
      if (trigger && (trigger === workspaceSpec.moduleId || deps.has(trigger))) {
        triggerAffectedTests.push(workspaceSpec);
      }
    }

    if (triggerAffectedTests.length) {
      await this.vitest.cancelCurrentRun('keyboard-input');
      await this.vitest.runningPromise;
      await this.vitest.runFiles(triggerAffectedTests, false);
    }
  }

  async runAffectedTestsAfterChange(file: string) {
    const id = slash(file);
    this.vitest?.logger.clearHighlightCache(id);
    this.updateLastChanged(id);
    this.storyCountForCurrentRun = 0;

    await this.runAffectedTests(file);
  }

  async registerVitestConfigListener() {
    this.vitest?.server?.watcher.on('change', async (file) => {
      file = normalize(file);
      const isConfig = file === this.vitest.server.config.configFile;
      if (isConfig) {
        log('Restarting Vitest due to config change');
        await this.closeVitest();
        await this.startVitest();
      }
    });
  }

  async setupWatchers() {
    this.resetTestNamePattern();
    this.vitest?.server?.watcher.removeAllListeners('change');
    this.vitest?.server?.watcher.removeAllListeners('add');
    this.vitest?.server?.watcher.on('change', this.runAffectedTestsAfterChange.bind(this));
    this.vitest?.server?.watcher.on('add', this.runAffectedTestsAfterChange.bind(this));
    this.registerVitestConfigListener();
  }

  resetTestNamePattern() {
    if (this.vitest) {
      this.vitest.configOverride.testNamePattern = undefined;
    }
  }

  isStorybookProject(project: TestProject | WorkspaceProject) {
    // eslint-disable-next-line no-underscore-dangle
    return !!project.config.env?.__STORYBOOK_URL__;
  }
}
