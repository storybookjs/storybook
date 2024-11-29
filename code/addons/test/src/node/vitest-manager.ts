import { existsSync } from 'node:fs';

import type { TestProject, TestSpecification, Vitest, WorkspaceProject } from 'vitest/node';

import type { Channel } from 'storybook/internal/channels';
import type { TestingModuleRunRequestPayload } from 'storybook/internal/core-events';

import path, { normalize } from 'pathe';
import slash from 'slash';

import { log } from '../logger';
import { StorybookReporter } from './reporter';
import type { TestManager } from './test-manager';

export class VitestManager {
  vitest: Vitest | null = null;

  vitestStartupCounter = 0;

  constructor(
    private channel: Channel,
    private testManager: TestManager
  ) {}

  async startVitest(watchMode = false) {
    const { createVitest } = await import('vitest/node');

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
      // @ts-expect-error we just want to disable coverage, not specify a provider
      coverage: {
        enabled: false,
      },
    });

    if (this.vitest) {
      this.vitest.onCancel(() => {
        // TODO: handle cancelation
      });
    }

    await this.vitest.init();

    if (watchMode) {
      await this.setupWatchers();
    }
  }

  async runAllTests() {
    if (!this.vitest) {
      await this.startVitest();
    }

    const storybookTests = await this.getStorybookTestSpecs();
    for (const storybookTest of storybookTests) {
      // make sure to clear the file cache so test results are updated even if watch mode is not enabled
      if (!this.testManager.watchMode) {
        this.updateLastChanged(storybookTest.moduleId);
      }
    }
    await this.cancelCurrentRun();
    await this.vitest!.runFiles(storybookTests, true);
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

  async runTests(testPayload: TestingModuleRunRequestPayload['payload']) {
    if (!this.vitest) {
      await this.startVitest();
    }

    // This list contains all the test files (story files) that need to be run
    // based on the test files that are passed in the tests array
    // This list does NOT contain any filtering of specific
    // test cases (story) within the test files
    const testList: TestSpecification[] = [];

    const storybookTests = await this.getStorybookTestSpecs();

    for (const storybookTest of storybookTests) {
      const match = testPayload.find((test) => {
        const absoluteImportPath = path.join(process.cwd(), test.importPath);
        return absoluteImportPath === storybookTest.moduleId;
      });
      if (match) {
        // make sure to clear the file cache so test results are updated even if watch mode is not enabled
        if (!this.testManager.watchMode) {
          this.updateLastChanged(storybookTest.moduleId);
        }

        testList.push(storybookTest);
      }
    }

    await this.cancelCurrentRun();
    await this.vitest!.runFiles(testList, true);
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
      await this.vitest.runFiles(triggerAffectedTests, true);
    }
  }

  async runAffectedTestsAfterChange(file: string) {
    const id = slash(file);
    this.vitest?.logger.clearHighlightCache(id);
    this.updateLastChanged(id);

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
    this.vitest?.server?.watcher.removeAllListeners('change');
    this.vitest?.server?.watcher.removeAllListeners('add');
    this.vitest?.server?.watcher.on('change', this.runAffectedTestsAfterChange.bind(this));
    this.vitest?.server?.watcher.on('add', this.runAffectedTestsAfterChange.bind(this));
    this.registerVitestConfigListener();
  }

  isStorybookProject(project: TestProject | WorkspaceProject) {
    // eslint-disable-next-line no-underscore-dangle
    return !!project.config.env?.__STORYBOOK_URL__;
  }
}
