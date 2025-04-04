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
import type {
  DocsIndexEntry,
  StoryId,
  StoryIndex,
  StoryIndexEntry,
} from 'storybook/internal/types';

import { findUp } from 'find-up';
import path, { dirname, join, normalize } from 'pathe';
import slash from 'slash';

import { COVERAGE_DIRECTORY } from '../constants';
import { log } from '../logger';
import type { TriggerRunEvent } from '../types';
import type { StorybookCoverageReporterOptions } from './coverage-reporter';
import { StorybookReporter } from './reporter';
import type { TestManager } from './test-manager';

const VITEST_CONFIG_FILE_EXTENSIONS = ['mts', 'mjs', 'cts', 'cjs', 'ts', 'tsx', 'js', 'jsx'];
const VITEST_WORKSPACE_FILE_EXTENSION = ['ts', 'js', 'json'];

type TagsFilter = {
  include: string[];
  exclude: string[];
  skip: string[];
};

const packageDir = dirname(require.resolve('@storybook/addon-vitest/package.json'));

// We have to tell Vitest that it runs as part of Storybook
process.env.VITEST_STORYBOOK = 'true';

export class VitestManager {
  vitest: Vitest | null = null;

  vitestStartupCounter = 0;

  vitestRestartPromise: Promise<void> | null = null;

  runningPromise: Promise<any> | null = null;

  constructor(private testManager: TestManager) {}

  async startVitest({ coverage }: { coverage: boolean }) {
    const { createVitest } = await import('vitest/node');

    const storybookCoverageReporter: [string, StorybookCoverageReporterOptions] = [
      join(packageDir, 'dist/node/coverage-reporter.js'),
      {
        testManager: this.testManager,
        coverageOptions: this.vitest?.config?.coverage as ResolvedCoverageOptions<'v8'> | undefined,
      },
    ];
    const coverageOptions = (
      coverage
        ? {
            enabled: true,
            clean: false,
            cleanOnRerun: false,
            reportOnFailure: true,
            reporter: [['html', {}], storybookCoverageReporter],
            reportsDirectory: resolvePathInStorybookCache(COVERAGE_DIRECTORY),
          }
        : { enabled: false }
    ) as CoverageOptions;

    const vitestWorkspaceConfig = await findUp([
      ...VITEST_WORKSPACE_FILE_EXTENSION.map((ext) => `vitest.workspace.${ext}`),
      ...VITEST_CONFIG_FILE_EXTENSIONS.map((ext) => `vitest.config.${ext}`),
    ]);

    this.vitest = await createVitest('test', {
      root: vitestWorkspaceConfig ? dirname(vitestWorkspaceConfig) : process.cwd(),
      watch: true,
      passWithNoTests: false,
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
    } catch (e: any) {
      let message = 'Failed to initialize Vitest';
      const isV8 = e.message?.includes('@vitest/coverage-v8');
      const isIstanbul = e.message?.includes('@vitest/coverage-istanbul');

      if (
        (e.message?.includes('Failed to load url') && (isIstanbul || isV8)) ||
        // Vitest will sometimes not throw the correct missing-package-detection error, so we have to check for this as well
        (e instanceof TypeError &&
          e?.message === "Cannot read properties of undefined (reading 'name')")
      ) {
        const coveragePackage = isIstanbul ? 'coverage-istanbul' : 'coverage-v8';
        message += `\n\nPlease install the @vitest/${coveragePackage} package to collect coverage\n`;
      }
      this.testManager.reportFatalError(message, e);
      return;
    }

    await this.setupWatchers();
  }

  async restartVitest({ coverage }: { coverage: boolean }) {
    await this.vitestRestartPromise;
    this.vitestRestartPromise = new Promise(async (resolve, reject) => {
      try {
        await this.runningPromise;
        await this.closeVitest();
        await this.startVitest({ coverage });
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        this.vitestRestartPromise = null;
      }
    });
    return this.vitestRestartPromise;
  }

  private resetGlobalTestNamePattern() {
    this.vitest?.setGlobalTestNamePattern('');
  }

  private updateLastChanged(filepath: string) {
    const projects = this.vitest!.getModuleProjects(filepath);
    projects.forEach(({ server, browser }) => {
      if (server) {
        const serverMods = server.moduleGraph.getModulesByFile(filepath);
        serverMods?.forEach((mod) => server.moduleGraph.invalidateModule(mod));
      }
      if (browser) {
        const browserMods = browser.vite.moduleGraph.getModulesByFile(filepath);
        browserMods?.forEach((mod) => browser.vite.moduleGraph.invalidateModule(mod));
      }
    });
  }

  private async fetchStories(requestStoryIds?: string[]) {
    const indexUrl = this.testManager.store.getState().indexUrl;
    if (!indexUrl) {
      throw new Error(
        'Tried to fetch stories to test, but the index URL was not set in the store yet.'
      );
    }
    try {
      const index = (await Promise.race([
        fetch(indexUrl).then((res) => res.json()),
        new Promise((_, reject) => setTimeout(reject, 3000, new Error('Request took too long'))),
      ])) as StoryIndex;
      const storyIds = requestStoryIds || Object.keys(index.entries);
      return storyIds.map((id) => index.entries[id]).filter((story) => story.type === 'story');
    } catch (e: any) {
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

  async runTests(runPayload: TriggerRunEvent['payload']) {
    const { watching, config } = this.testManager.store.getState();
    const coverageShouldBeEnabled =
      config.coverage && !watching && (runPayload?.storyIds?.length ?? 0) === 0;
    const currentCoverage = this.vitest?.config.coverage?.enabled;

    if (!this.vitest) {
      await this.startVitest({ coverage: coverageShouldBeEnabled });
    } else if (currentCoverage !== coverageShouldBeEnabled) {
      await this.restartVitest({ coverage: coverageShouldBeEnabled });
    } else {
      await this.vitestRestartPromise;
    }

    this.resetGlobalTestNamePattern();

    const stories = await this.fetchStories(runPayload?.storyIds);
    const vitestTestSpecs = await this.getStorybookTestSpecs();
    const isSingleStoryRun = runPayload.storyIds?.length === 1;

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
          if (!this.testManager.store.getState().watching) {
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
    this.testManager.store.setState((s) => ({
      ...s,
      currentRun: {
        ...s.currentRun,
        totalTestCount,
      },
    }));

    if (isSingleStoryRun) {
      const storyName = stories[0].name;
      const regex = new RegExp(`^${storyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
      this.vitest!.setGlobalTestNamePattern(regex);
    }

    await this.vitest!.runTestSpecifications(filteredTestFiles, true);
    this.resetGlobalTestNamePattern();
  }

  async cancelCurrentRun() {
    await this.vitest?.cancelCurrentRun('keyboard-input');
    await this.runningPromise;
  }

  async closeVitest() {
    await this.vitest?.close();
  }

  async getStorybookTestSpecs() {
    const globTestSpecifications = (await this.vitest?.globTestSpecifications()) ?? [];
    return (
      globTestSpecifications.filter((workspaceSpec) =>
        this.isStorybookProject(workspaceSpec.project)
      ) ?? []
    );
  }

  private async getTestDependencies(spec: TestSpecification) {
    const deps = new Set<string>();

    const addImports = async (project: TestProject, filepath: string) => {
      if (deps.has(filepath)) {
        return;
      }
      deps.add(filepath);

      const mod = project.vite.moduleGraph.getModuleById(filepath);
      const transformed =
        mod?.ssrTransformResult || (await project.vite.transformRequest(filepath));

      if (!transformed) {
        return;
      }
      const dependencies = [...(transformed.deps || []), ...(transformed.dynamicDeps || [])];
      await Promise.all(
        dependencies.map(async (dep) => {
          const idPath = await project.vite.pluginContainer.resolveId(dep, filepath, {
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

    await addImports(spec.project, spec.moduleId);
    deps.delete(spec.moduleId);

    return deps;
  }

  async runAffectedTests(trigger: string) {
    if (!this.vitest) {
      return;
    }
    this.resetGlobalTestNamePattern();

    const globTestFiles = await this.vitest.globTestSpecifications();

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

    const stories = this.testManager.store.getState().indexUrl ? await this.fetchStories() : [];

    const affectedStoryIds = triggerAffectedTests
      .map((spec) =>
        stories
          .filter((story) => join(process.cwd(), story.importPath) === spec.moduleId)
          .map((story) => story.id)
      )
      .flat();

    await this.testManager.runTestsWithState({
      storyIds: affectedStoryIds,
      triggeredBy: 'watch',
      callback: async () => {
        if (triggerAffectedTests.length) {
          await this.vitest!.cancelCurrentRun('keyboard-input');
          await this.runningPromise;
          await this.vitest!.runTestSpecifications(triggerAffectedTests, false);
        }
      },
    });
  }

  async runAffectedTestsAfterChange(file: string) {
    const id = slash(file);
    this.vitest?.logger.clearHighlightCache(id);
    this.updateLastChanged(id);

    // when watch mode is disabled, don't trigger any tests (below)
    // but still invalidate the cache for the changed file, which is handled above
    if (!this.testManager.store.getState().watching) {
      return;
    }

    await this.runAffectedTests(file);
  }

  async registerVitestConfigListener() {
    this.vitest!.vite.watcher.on('change', async (file) => {
      file = normalize(file);
      const isConfig = file === this.vitest?.vite?.config.configFile;
      if (isConfig) {
        log('Restarting Vitest due to config change');
        const { watching, config } = this.testManager.store.getState();
        await this.restartVitest({ coverage: config.coverage && !watching });
      }
    });
  }

  async setupWatchers() {
    this.resetGlobalTestNamePattern();
    this.vitest!.vite.watcher.removeAllListeners('change');
    this.vitest!.vite.watcher.removeAllListeners('add');
    this.vitest!.vite.watcher.on('change', this.runAffectedTestsAfterChange.bind(this));
    this.vitest!.vite.watcher.on('add', this.runAffectedTestsAfterChange.bind(this));
    this.registerVitestConfigListener();
  }

  isStorybookProject(project: TestProject | WorkspaceProject) {
    // eslint-disable-next-line no-underscore-dangle
    return !!project.config.env?.__STORYBOOK_URL__;
  }
}
