import { existsSync } from 'node:fs';

import type {
  CoverageOptions,
  ResolvedCoverageOptions,
  TestProject,
  TestSpecification,
  Vitest,
  WorkspaceProject,
} from 'vitest/node';

import { getProjectRoot, resolvePathInStorybookCache } from 'storybook/internal/common';
import type { StoryId, StoryIndex, StoryIndexEntry } from 'storybook/internal/types';

import { findUp } from 'find-up';
import path, { dirname, join, normalize } from 'pathe';
import slash from 'slash';

import { resolvePackageDir } from '../../../../core/src/shared/utils/module';
import { COVERAGE_DIRECTORY } from '../constants';
import { log } from '../logger';
import type { TriggerRunEvent } from '../types';
import type { StorybookCoverageReporterOptions } from './coverage-reporter';
import { StorybookReporter } from './reporter';
import type { TestManager } from './test-manager';

const VITEST_CONFIG_FILE_EXTENSIONS = ['mts', 'mjs', 'cts', 'cjs', 'ts', 'tsx', 'js', 'jsx'];
const VITEST_WORKSPACE_FILE_EXTENSION = ['ts', 'js', 'json'];

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
      join(resolvePackageDir('@storybook/addon-vitest'), 'static/coverage-reporter.cjs'),
      {
        testManager: this.testManager,
        coverageOptions: this.vitest?.config?.coverage as ResolvedCoverageOptions<'v8'> | undefined,
      },
    ];
    const coverageOptions = (
      coverage
        ? {
            enabled: true,
            clean: true,
            cleanOnRerun: true,
            reportOnFailure: true,
            reporter: [['html', {}], storybookCoverageReporter],
            reportsDirectory: resolvePathInStorybookCache(COVERAGE_DIRECTORY),
          }
        : { enabled: false }
    ) as CoverageOptions;

    const vitestWorkspaceConfig = await findUp(
      [
        ...VITEST_WORKSPACE_FILE_EXTENSION.map((ext) => `vitest.workspace.${ext}`),
        ...VITEST_CONFIG_FILE_EXTENSIONS.map((ext) => `vitest.config.${ext}`),
      ],
      { stopAt: getProjectRoot() }
    );

    const projectName = 'storybook:' + process.env.STORYBOOK_CONFIG_DIR;

    try {
      this.vitest = await createVitest('test', {
        root: vitestWorkspaceConfig ? dirname(vitestWorkspaceConfig) : process.cwd(),
        watch: true,
        passWithNoTests: false,
        project: [projectName],
        // TODO:
        // Do we want to enable Vite's default reporter?
        // The output in the terminal might be too spamy and it might be better to
        // find a way to just show errors and warnings for example
        // Otherwise it might be hard for the user to discover Storybook related logs
        reporters: ['default', new StorybookReporter(this.testManager)],
        coverage: coverageOptions,
      });
    } catch (err: any) {
      const originalMessage = String(err.message);
      if (originalMessage.includes('Found multiple projects')) {
        const custom = [
          'Storybook was unable to start the test run because you have multiple Vitest projects (or browsers) in headed mode.',
          'Please set `headless: true` in your Storybook vitest config.\n\n',
        ].join('\n');

        if (!originalMessage.startsWith(custom)) {
          err.message = `${custom}${originalMessage}`;
        }
      }

      throw err;
    }

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
        await this.vitest?.close();
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

  private filterTestSpecifications(
    testSpecifications: TestSpecification[],
    stories: StoryIndexEntry[]
  ) {
    const filteredTestSpecifications: TestSpecification[] = [];
    const filteredStoryIds: StoryId[] = [];

    const storiesByImportPath: Record<StoryIndexEntry['importPath'], StoryIndexEntry[]> = {};

    for (const story of stories) {
      const absoluteImportPath = path.join(process.cwd(), story.importPath);
      if (!storiesByImportPath[absoluteImportPath]) {
        storiesByImportPath[absoluteImportPath] = [];
      }
      storiesByImportPath[absoluteImportPath].push(story);
    }

    for (const testSpecification of testSpecifications) {
      const { env = {} } = testSpecification.project.config;
      const include = env.__VITEST_INCLUDE_TAGS__?.split(',').filter(Boolean) ?? ['test'];
      const exclude = env.__VITEST_EXCLUDE_TAGS__?.split(',').filter(Boolean) ?? [];
      const skip = env.__VITEST_SKIP_TAGS__?.split(',').filter(Boolean) ?? [];

      const storiesInTestSpecification = storiesByImportPath[testSpecification.moduleId] ?? [];

      const filteredStories = storiesInTestSpecification.filter((story) => {
        if (include.length && !include.some((tag) => story.tags?.includes(tag))) {
          return false;
        }
        if (exclude.some((tag) => story.tags?.includes(tag))) {
          return false;
        }
        // Skipped tests are intentionally included here
        return true;
      });

      if (!filteredStories.length) {
        continue;
      }

      if (!this.testManager.store.getState().watching) {
        // Clear the file cache if watch mode is disabled
        this.updateLastChanged(testSpecification.moduleId);
      }

      filteredTestSpecifications.push(testSpecification);
      filteredStoryIds.push(
        ...filteredStories
          // Don't count skipped stories, because StorybookReporter doesn't include them either
          .filter((story) => !skip.some((tag) => story.tags?.includes(tag)))
          .map((story) => story.id)
      );
    }

    return { filteredTestSpecifications, filteredStoryIds };
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

    await this.cancelCurrentRun();

    const testSpecifications = await this.getStorybookTestSpecifications();
    const stories = await this.fetchStories(runPayload?.storyIds);

    const isSingleStoryRun = runPayload.storyIds?.length === 1;
    if (isSingleStoryRun) {
      const storyName = stories[0].name;
      const regex = new RegExp(`^${storyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
      this.vitest!.setGlobalTestNamePattern(regex);
    }

    const { filteredTestSpecifications, filteredStoryIds } = this.filterTestSpecifications(
      testSpecifications,
      stories
    );

    this.testManager.store.setState((s) => ({
      ...s,
      currentRun: {
        ...s.currentRun,
        totalTestCount: filteredStoryIds.length,
      },
    }));

    await this.vitest!.runTestSpecifications(filteredTestSpecifications, true);
    this.resetGlobalTestNamePattern();
  }

  async cancelCurrentRun() {
    await this.vitest?.cancelCurrentRun('keyboard-input');
    await this.runningPromise;
  }

  async getStorybookTestSpecifications() {
    const globTestSpecifications = (await this.vitest?.globTestSpecifications()) ?? [];
    return (
      globTestSpecifications.filter((workspaceSpec) =>
        this.isStorybookProject(workspaceSpec.project)
      ) ?? []
    );
  }

  async runAffectedTestsAfterChange(changedFilePath: string, event: 'change' | 'add') {
    const id = slash(changedFilePath);
    this.vitest?.logger.clearHighlightCache(id);
    this.updateLastChanged(id);

    if (event === 'add') {
      const project = this.vitest?.projects.find(this.isStorybookProject.bind(this));
      // This function not only tests whether a file matches the test globs, but it also
      // adds the file to the project's internal testFilesList
      project?.matchesTestGlob(id);
    }

    // when watch mode is disabled, don't trigger any tests (below)
    // but still invalidate the cache for the changed file, which is handled above
    if (!this.testManager.store.getState().watching) {
      return;
    }
    if (!this.vitest) {
      return;
    }
    this.resetGlobalTestNamePattern();

    const storybookProject = this.vitest!.projects.find((p) => this.isStorybookProject(p));
    // we create synthetic TestSpecifications for the preview annotations and setup files, so that we can analyze their dependencies
    const previewAnnotationSpecifications = this.testManager.store
      .getState()
      .previewAnnotations.map((previewAnnotation) => {
        return {
          project: storybookProject ?? this.vitest!.projects[0],
          moduleId:
            typeof previewAnnotation === 'string' ? previewAnnotation : previewAnnotation.absolute,
        };
      }) as TestSpecification[];
    const setupFilesSpecifications = this.vitest!.projects.flatMap((project) =>
      project.config.setupFiles.map((setupFile) => ({
        project,
        moduleId: setupFile,
      }))
    ) as TestSpecification[];
    const syntheticGlobalTestSpecifications =
      previewAnnotationSpecifications.concat(setupFilesSpecifications);

    const testSpecifications = await this.getStorybookTestSpecifications();
    const allStories = await this.fetchStories();

    let affectsGlobalFiles = false;

    const affectedTestSpecifications = (
      await Promise.all(
        syntheticGlobalTestSpecifications
          .concat(testSpecifications)
          .map(async (testSpecification) => {
            const dependencies = await this.getTestDependencies(testSpecification);
            if (
              changedFilePath === testSpecification.moduleId ||
              dependencies.has(changedFilePath)
            ) {
              // if the changed file path affects a preview annotation or setup file
              // we mark global files as affected, which triggers a run of _all_ tests
              if (syntheticGlobalTestSpecifications.includes(testSpecification)) {
                affectsGlobalFiles = true;
              }
              return testSpecification;
            }
          })
      )
    ).filter(Boolean) as TestSpecification[];

    const testSpecificationsToRun = affectsGlobalFiles
      ? testSpecifications
      : affectedTestSpecifications;

    if (!testSpecificationsToRun.length) {
      return;
    }

    const { filteredTestSpecifications, filteredStoryIds } = this.filterTestSpecifications(
      testSpecificationsToRun,
      allStories
    );
    await this.testManager.runTestsWithState({
      storyIds: filteredStoryIds,
      triggeredBy: 'watch',
      callback: async () => {
        this.testManager.store.setState((s) => ({
          ...s,
          currentRun: {
            ...s.currentRun,
            totalTestCount: filteredStoryIds.length,
          },
        }));
        await this.vitest!.cancelCurrentRun('keyboard-input');
        await this.runningPromise;
        await this.vitest!.runTestSpecifications(filteredTestSpecifications, false);
      },
    });
  }

  // This is an adaptation of Vitest's own implementation
  // see https://github.com/vitest-dev/vitest/blob/14409088166152c920ce7fa4ad4c0ba57149b869/packages/vitest/src/node/specifications.ts#L171-L198
  private async getTestDependencies(spec: TestSpecification) {
    const deps = new Set<string>();

    const addImports = async (project: TestProject, filepath: string) => {
      if (deps.has(filepath)) {
        return;
      }
      deps.add(filepath);

      const mod = project.vite.moduleGraph.getModuleById(filepath);
      const transformed =
        mod?.ssrTransformResult || (await project.vite.transformRequest(filepath, { ssr: true }));
      if (!transformed) {
        return;
      }

      const dependencies = [...(transformed.deps ?? []), ...(transformed.dynamicDeps ?? [])];

      await Promise.all(
        dependencies.map(async (dep) => {
          const fsPath = dep.startsWith('/@fs/')
            ? dep.slice(process.platform === 'win32' ? 5 : 4)
            : join(project.config.root, dep);

          if (!fsPath.includes('node_modules') && !deps.has(fsPath) && existsSync(fsPath)) {
            await addImports(project, fsPath);
          }
        })
      );
    };

    await addImports(spec.project, spec.moduleId);
    deps.delete(spec.moduleId);

    return deps;
  }

  async registerVitestConfigListener() {
    this.vitest!.vite.watcher.on('change', async (file) => {
      const isConfig = normalize(file) === this.vitest?.vite?.config.configFile;
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
    this.vitest!.vite.watcher.on('change', (file) =>
      this.runAffectedTestsAfterChange(file, 'change')
    );
    this.vitest!.vite.watcher.on('add', (file) => {
      this.runAffectedTestsAfterChange(file, 'add');
    });
    this.registerVitestConfigListener();
  }

  isStorybookProject(project: TestProject | WorkspaceProject) {
    return !!project.config.env?.__STORYBOOK_URL__;
  }
}
