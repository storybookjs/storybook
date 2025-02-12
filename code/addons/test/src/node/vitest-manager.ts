import { existsSync } from 'node:fs';

import type {
  CoverageOptions,
  ResolvedCoverageOptions,
  TestProject,
  TestRunResult,
  TestSpecification,
  Vitest,
  WorkspaceProject,
} from 'vitest/node';
import * as vitestNode from 'vitest/node';

import { resolvePathInStorybookCache } from 'storybook/internal/common';
import type { TestingModuleRunRequestPayload } from 'storybook/internal/core-events';

import type { DocsIndexEntry, StoryIndex, StoryIndexEntry } from '@storybook/types';

import { findUp } from 'find-up';
import path, { dirname, join, normalize } from 'pathe';
import { satisfies } from 'semver';
import slash from 'slash';

import { COVERAGE_DIRECTORY, type Config } from '../constants';
import { log } from '../logger';
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

const packageDir = dirname(require.resolve('@storybook/experimental-addon-test/package.json'));

const vitestVersion = vitestNode.version;
const isVitest3OrLater = vitestVersion
  ? satisfies(vitestVersion, '>=3.0.0-beta.3', { includePrerelease: true })
  : false;

// We have to tell Vitest that it runs as part of Storybook
process.env.VITEST_STORYBOOK = 'true';

export class VitestManager {
  vitest: Vitest | null = null;

  vitestStartupCounter = 0;

  vitestRestartPromise: Promise<void> | null = null;

  storyCountForCurrentRun: number = 0;

  runningPromise: Promise<any> | null = null;

  isCancelling = false;

  constructor(private testManager: TestManager) {}

  async startVitest({ coverage = false } = {}) {
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

  private setGlobalTestNamePattern(pattern: string | RegExp) {
    if (isVitest3OrLater) {
      this.vitest!.setGlobalTestNamePattern(pattern);
    } else {
      // @ts-expect-error vitest.configOverride is a Vitest < 3 API.
      this.vitest!.configOverride.testNamePattern = pattern;
    }
  }

  private resetGlobalTestNamePattern() {
    if (this.vitest) {
      this.setGlobalTestNamePattern('');
    }
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

  private async fetchStories(indexUrl: string, requestStoryIds?: string[]) {
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

  private get vite() {
    // TODO: vitest.server is a Vitest < 3.0.0 API. Remove as soon as we don't support < 3.0.0 anymore.
    return isVitest3OrLater ? this.vitest?.vite : this.vitest?.server;
  }

  async runFiles(specifications: TestSpecification[], allTestsRun?: boolean) {
    this.isCancelling = false;
    const runTest: (
      specifications: TestSpecification[],
      allTestsRun?: boolean | undefined
      // @ts-expect-error vitest.runFiles is a Vitest < 3.0.0 API. Remove as soon as we don't support < 3.0.0 anymore.
    ) => Promise<TestRunResult> = this.vitest!.runFiles ?? this.vitest!.runTestSpecifications;
    this.runningPromise = runTest.call(this.vitest, specifications, allTestsRun);
    await this.runningPromise;
    this.runningPromise = null;
  }

  async runTests(requestPayload: TestingModuleRunRequestPayload<Config>) {
    if (!this.vitest) {
      await this.startVitest();
    } else {
      await this.vitestRestartPromise;
    }

    this.resetGlobalTestNamePattern();

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
          if (!this.testManager.config.watchMode) {
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
      const regex = new RegExp(`^${storyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
      this.setGlobalTestNamePattern(regex);
    }

    await this.runFiles(filteredTestFiles, true);
    this.resetGlobalTestNamePattern();
  }

  async cancelCurrentRun() {
    this.isCancelling = true;
    await this.vitest?.cancelCurrentRun('keyboard-input');
    await this.runningPromise;
    this.isCancelling = false;
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
    const addImports = async (project: TestProject, filepath: string) => {
      if (deps.has(filepath)) {
        return;
      }
      deps.add(filepath);

      // TODO: Remove project.server once we don't support Vitest < 3.0.0 anymore
      const server = isVitest3OrLater ? project.vite : project.server;

      const mod = server.moduleGraph.getModuleById(filepath);
      // @ts-expect-error project.vitenode is a Vitest < 3 API.
      const viteNode = isVitest3OrLater ? project.vite : project.vitenode;
      const transformed = mod?.ssrTransformResult || (await viteNode.transformRequest(filepath));
      if (!transformed) {
        return;
      }
      const dependencies = [...(transformed.deps || []), ...(transformed.dynamicDeps || [])];
      await Promise.all(
        dependencies.map(async (dep) => {
          const idPath = await server.pluginContainer.resolveId(dep, filepath, {
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

    await addImports(
      // @ts-expect-error spec.project.workspaceProject is a Vitest < 3 API.
      isVitest3OrLater ? spec.project : spec.project.workspaceProject,
      spec.moduleId
    );
    deps.delete(spec.moduleId);

    return deps;
  }

  async runAffectedTests(trigger: string) {
    if (!this.vitest) {
      return;
    }
    this.resetGlobalTestNamePattern();

    const globTestSpecs: (filters?: string[] | undefined) => Promise<TestSpecification[]> =
      // TODO: vitest.globTestSpecs is a Vitest < 3.0.0 API.
      isVitest3OrLater ? this.vitest.globTestSpecifications : this.vitest.globTestSpecs;

    const globTestFiles = await globTestSpecs.call(this.vitest);

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
      await this.runningPromise;
      await this.runFiles(triggerAffectedTests, false);
    }
  }

  async runAffectedTestsAfterChange(file: string) {
    const id = slash(file);
    this.vitest?.logger.clearHighlightCache(id);
    this.updateLastChanged(id);

    // when watch mode is disabled, don't trigger any tests (below)
    // but still invalidate the cache for the changed file, which is handled above
    if (!this.testManager.config.watchMode) {
      return;
    }

    this.storyCountForCurrentRun = 0;
    await this.runAffectedTests(file);
  }

  async registerVitestConfigListener() {
    this.vite?.watcher.on('change', async (file) => {
      file = normalize(file);
      const isConfig = file === this.vite?.config.configFile;
      if (isConfig) {
        log('Restarting Vitest due to config change');
        await this.closeVitest();
        await this.startVitest();
      }
    });
  }

  async setupWatchers() {
    this.resetGlobalTestNamePattern();
    const server = this.vite;
    server?.watcher.removeAllListeners('change');
    server?.watcher.removeAllListeners('add');
    server?.watcher.on('change', this.runAffectedTestsAfterChange.bind(this));
    server?.watcher.on('add', this.runAffectedTestsAfterChange.bind(this));
    this.registerVitestConfigListener();
  }

  isStorybookProject(project: TestProject | WorkspaceProject) {
    // eslint-disable-next-line no-underscore-dangle
    return !!project.config.env?.__STORYBOOK_URL__;
  }
}
