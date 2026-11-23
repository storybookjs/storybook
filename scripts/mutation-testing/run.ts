import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, globSync, rmSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { join, relative, resolve } from 'pathe';

import { OUTPUT_DIR, ROOT } from './paths.ts';
import { formatIdleTests } from './report.ts';

const STRYKER_DIR = join(import.meta.dirname, 'stryker');
const STRYKER_BIN = join(STRYKER_DIR, 'node_modules', '.bin', 'stryker');

const DEFAULT_MUTATE = ['src/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'];
const NEVER_MUTATED = [
  '!**/*.{test,test-d,spec,stories,bench}.*',
  '!**/*.d.ts',
  '!**/__*__/**',
  '!**/{template,templates}/**',
  // Stryker cannot instrument an export under a string name.
  '!src/node/coverage-reporter.ts',
];

// Mutants reached by few pending tests go first. A test with a mutant of its own to kill has then
// stopped running by the time the mutants that most tests reach are tried.
const MAX_PENDING_TESTS_PER_PASS = [50, Infinity];

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    mutate: { type: 'string', multiple: true },
    concurrency: { type: 'string' },
    pool: { type: 'string' },
    'module-load-mutants': { type: 'boolean', default: false },
    resume: { type: 'boolean', default: false },
  },
});

if (positionals.length === 0) {
  console.error(
    'Usage: node scripts/mutation-testing/run.ts <package-dir>... [--mutate <glob>]... [--concurrency <n>] [--pool <vitest-pool>] [--module-load-mutants] [--resume]'
  );
  process.exit(1);
}
if (!existsSync(STRYKER_BIN)) {
  console.error(`Stryker is not installed. Run: yarn --cwd ${relative(ROOT, STRYKER_DIR)} install`);
  process.exit(1);
}

const git = (packageDir: string, ...args: string[]) =>
  execFileSync('git', args, { cwd: packageDir, encoding: 'utf8' });

// A test helper that calls `vi.mock` stops working once Stryker wraps its statements.
function findTestHelpers(packageDir: string) {
  try {
    return git(packageDir, 'grep', '-lE', `from ['"]vitest['"]`, '--', 'src')
      .split('\n')
      .filter((file) => file !== '' && !file.includes('.test.'));
  } catch {
    return [];
  }
}

// Stryker does not always remove the setup file of each of its test runners.
function removeSetupFiles(packageDir: string) {
  for (const setupFile of globSync('stryker-setup-*.js', { cwd: packageDir })) {
    rmSync(join(packageDir, setupFile));
  }
}

async function runStryker(packageDir: string, configFile: string, env: NodeJS.ProcessEnv) {
  const stryker = spawn(STRYKER_BIN, ['run', configFile], {
    cwd: packageDir,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  // A terminal interrupt reaches Stryker directly, and a second signal would abort its cleanup.
  const ignore = () => {};
  const terminate = () => stryker.kill('SIGTERM');
  process.on('SIGINT', ignore).on('SIGTERM', terminate);
  const [exitCode] = await once(stryker, 'exit');
  process.off('SIGINT', ignore).off('SIGTERM', terminate);
  return exitCode;
}

async function mutatePackage(packageDir: string) {
  if (!existsSync(join(packageDir, 'vitest.config.ts'))) {
    throw new Error(`${packageDir} has no vitest.config.ts`);
  }
  if (git(packageDir, 'status', '--porcelain', '--', '.') !== '') {
    throw new Error(
      `${packageDir} has uncommitted changes. Stryker rewrites the sources in place, and an interrupted run is undone with git.`
    );
  }

  const outputDir = join(OUTPUT_DIR, relative(ROOT, packageDir));
  if (!values.resume) {
    await rm(outputDir, { recursive: true, force: true });
  }
  await mkdir(outputDir, { recursive: true });

  const vitestConfigFile = join(outputDir, 'vitest.config.ts');
  await writeFile(
    vitestConfigFile,
    [
      `import { defineConfig, mergeConfig } from 'vitest/config';`,
      `import config from ${JSON.stringify(join(packageDir, 'vitest.config.ts'))};`,
      // A type test cannot fail for a mutant, and would rerun the compiler for many of them.
      `const withoutTypeTests = { test: { typecheck: { enabled: false } } };`,
      `export default defineConfig(async (env) =>`,
      `  mergeConfig(typeof config === 'function' ? await config(env) : config, withoutTypeTests)`,
      `);`,
    ].join('\n')
  );

  const strykerConfigFile = join(outputDir, 'stryker.config.json');
  await writeFile(
    strykerConfigFile,
    JSON.stringify({
      testRunner: 'vitest-pending-tests',
      plugins: [join(STRYKER_DIR, 'pending-tests-runner.js')],
      vitest: { configFile: vitestConfigFile, pool: values.pool },
      mutate: [
        ...(values.mutate ?? DEFAULT_MUTATE),
        ...NEVER_MUTATED,
        ...findTestHelpers(packageDir).map((file) => `!${file}`),
      ],
      concurrency: values.concurrency ? Number(values.concurrency) : undefined,
      disableBail: true,
      // Workspace packages resolve to their real sources, which a sandbox copy would not mutate.
      inPlace: true,
      // Stryker would otherwise prepend `// @ts-nocheck` to sources that tests read from disk.
      disableTypeChecks: false,
      // Tests that scan the package must not find Stryker's backup of it.
      tempDirName: join(outputDir, 'tmp'),
      reporters: ['json', 'progress-append-only'],
      jsonReporter: { fileName: join(outputDir, 'mutation.json') },
    })
  );

  for (const maxPendingTests of MAX_PENDING_TESTS_PER_PASS) {
    const exitCode = await runStryker(packageDir, strykerConfigFile, {
      STORYBOOK_MUTATION_STATE_DIR: outputDir,
      STORYBOOK_MUTATION_MAX_PENDING_TESTS: String(maxPendingTests),
      STORYBOOK_MUTATION_MODULE_LOAD_MUTANTS: String(values['module-load-mutants']),
    });
    removeSetupFiles(packageDir);
    if (exitCode !== 0) {
      git(packageDir, 'checkout', '--', '.');
      throw new Error(`Stryker failed in ${packageDir}. Rerun with --resume to continue.`);
    }
  }

  console.log(formatIdleTests(packageDir));
}

for (const packageDir of positionals) {
  await mutatePackage(resolve(packageDir));
}
