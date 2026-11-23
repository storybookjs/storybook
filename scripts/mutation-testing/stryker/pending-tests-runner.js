import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  PluginKind,
  commonTokens,
  declareFactoryPlugin,
  tokens,
} from '@stryker-mutator/api/plugin';
import { DryRunStatus, MutantRunStatus, TestStatus } from '@stryker-mutator/api/test-runner';
import {
  strykerValidationSchema,
  strykerPlugins as vitestRunnerPlugins,
} from '@stryker-mutator/vitest-runner';

const stateDir = process.env.STORYBOOK_MUTATION_STATE_DIR;
const maxPendingTests = Number(process.env.STORYBOOK_MUTATION_MAX_PENDING_TESTS);
const tryEveryImportingTest = process.env.STORYBOOK_MUTATION_MODULE_LOAD_MUTANTS === 'true';

const killingTestsFile = join(stateDir, 'killing-tests.jsonl');
const testedMutantsFile = join(stateDir, 'tested-mutants.jsonl');
const passingTestsFile = join(stateDir, 'passing-tests.json');
const failingTestsFile = join(stateDir, 'failing-tests.json');
const moduleLoadMutantsFile = join(stateDir, 'module-load-mutants.json');

const readLines = (file) =>
  new Set(existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean) : []);
const appendLines = (file, lines) =>
  appendFileSync(file, lines.map((line) => `${line}\n`).join(''));

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

const SKIPPED = { status: MutantRunStatus.Survived, nrOfTests: 0 };

// Answers "which tests never fail for any mutant they reach?" at a fraction of the cost of a full
// mutation run: a test that has killed one mutant is never run again.
class PendingTestsRunner {
  #vitestRunner;
  #options;
  #passingTests;
  #moduleLoadMutants;

  constructor(vitestRunner, options) {
    this.#vitestRunner = vitestRunner;
    this.#options = options;
  }

  capabilities() {
    return this.#vitestRunner.capabilities();
  }

  init() {
    return this.#vitestRunner.init();
  }

  dispose() {
    return this.#vitestRunner.dispose();
  }

  // Stryker aborts when any test fails without a mutant. Tests that fail on instrumented sources
  // are set aside instead, so one of them does not block a whole package.
  async dryRun(options) {
    // Every test runs, including those that import none of the mutated files.
    this.#options.vitest.related = false;
    const result = await this.#vitestRunner.dryRun(options);
    if (result.status !== DryRunStatus.Complete) {
      return result;
    }
    const failing = result.tests.filter((test) => test.status === TestStatus.Failed);
    for (const { id } of failing) {
      delete result.mutantCoverage?.perTest[id];
    }
    const passing = result.tests
      .filter((test) => test.status === TestStatus.Success)
      .map(({ id }) => id);
    writeFileSync(passingTestsFile, JSON.stringify(passing));
    writeFileSync(
      moduleLoadMutantsFile,
      JSON.stringify(indexModuleLoadMutants(result.mutantCoverage, passing))
    );
    writeFileSync(
      failingTestsFile,
      JSON.stringify(failing.map(({ id, failureMessage }) => ({ id, failureMessage })))
    );
    return { ...result, tests: result.tests.filter((test) => test.status !== TestStatus.Failed) };
  }

  async mutantRun(options) {
    const { fileName, location, mutatorName, replacement } = options.activeMutant;
    const mutant = JSON.stringify([fileName, location.start, mutatorName, replacement]);
    if (readLines(testedMutantsFile).has(mutant)) {
      return SKIPPED;
    }

    this.#passingTests ??= readJson(passingTestsFile);
    this.#moduleLoadMutants ??= readJson(moduleLoadMutantsFile);

    // Stryker passes no tests for a mutant that also runs while a module loads. Such a mutant is
    // tried against the tests that run it, or against every test of the files importing the module.
    const runsAtModuleLoad = options.testFilter === undefined;
    const reachingAtModuleLoad = tryEveryImportingTest
      ? this.#passingTests
      : (this.#moduleLoadMutants[options.activeMutant.id] ?? []).map(
          (index) => this.#passingTests[index]
        );
    const reaching = runsAtModuleLoad ? reachingAtModuleLoad : options.testFilter;
    const killingTests = readLines(killingTestsFile);
    const pending = reaching.filter((id) => !killingTests.has(JSON.stringify(id)));
    // A mutant that many pending tests reach is left for a later pass, when tests with a mutant
    // of their own to kill no longer count as pending.
    if (pending.length === 0 || pending.length > maxPendingTests) {
      return SKIPPED;
    }

    this.#options.vitest.related = runsAtModuleLoad && tryEveryImportingTest;
    const result = await this.#vitestRunner.mutantRun({ ...options, testFilter: pending });
    appendLines(testedMutantsFile, [mutant]);
    if (result.status === MutantRunStatus.Killed) {
      appendLines(
        killingTestsFile,
        result.killedBy.map((id) => JSON.stringify(id))
      );
    }
    return result;
  }
}

// Maps each mutant that runs while a module loads to the tests that run it too, as indexes into
// the passing tests.
function indexModuleLoadMutants(mutantCoverage, passingTests) {
  const testsByMutant = {};
  passingTests.forEach((test, index) => {
    for (const mutant of Object.keys(mutantCoverage?.perTest[test] ?? {})) {
      if (mutant in mutantCoverage.static) {
        (testsByMutant[mutant] ??= []).push(index);
      }
    }
  });
  return testsByMutant;
}

const createVitestRunner = vitestRunnerPlugins[0].factory;

function createPendingTestsRunner(injector) {
  return new PendingTestsRunner(
    injector.injectFunction(createVitestRunner),
    injector.resolve(commonTokens.options)
  );
}
createPendingTestsRunner.inject = tokens(commonTokens.injector);

export const strykerPlugins = [
  declareFactoryPlugin(PluginKind.TestRunner, 'vitest-pending-tests', createPendingTestsRunner),
];

// Re-exported so Stryker validates and defaults the `vitest` options block for this runner too.
export { strykerValidationSchema };
