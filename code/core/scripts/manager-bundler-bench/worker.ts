/**
 * Runs the manager builder's bundling step in this process and prints timings as JSON.
 *
 * The measured step starts before the bundler is loaded and ends when every manager bundle is on
 * disk, which is what the manager builder waits for before it renders the page.
 *
 * The process is the unit of a "cold" sample: nothing is loaded before the clock starts except the
 * manager builder itself, so the sample includes loading the bundler and its first build. Further
 * builds in the same process are reported as "warm" samples.
 *
 * Usage: `node worker.ts <input.json>`, see `Input`.
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { loadManagerBuilder } from './builder.ts';

export type Input = {
  /**
   * - `esbuild`: the esbuild path of this checkout
   * - `rolldown`: the Rolldown path of this checkout
   * - `external`: the manager builder of another checkout (`coreDir`), which bundles and writes in
   *   one call. That checkout's `builder-manager/index.ts` has to export `bundleManagerEntries`
   *   and `globalsModuleInfoMap`, and be compiled.
   */
  bundler: 'esbuild' | 'rolldown' | 'external';
  /**
   * `STORYBOOK_MANAGER_ROLLDOWN_VARIANT` for the `rolldown` bundler. For `esbuild`, `lite` turns
   * off `minifySyntax` and tree-shaking, the work that the lighter Rolldown setups also skip.
   */
  variant?: string;
  /** `code/core` of the checkout whose compiled manager builder is measured. */
  coreDir?: string;
  mode: 'dev' | 'build';
  entries: string[];
  envs: Record<string, string>;
  cacheKey: string;
  warmIterations?: number;
  /** When set, the bundles are written here and kept. */
  outputDir?: string;
  /** Lets addons built for Storybook 10 bundle, see `loadManagerBuilder`. */
  shimRemovedExports?: boolean;
};

const input: Input = JSON.parse(readFileSync(process.argv[2], 'utf8'));

process.env.STORYBOOK_MANAGER_BUNDLER = input.bundler;
process.env.STORYBOOK_MANAGER_ROLLDOWN_VARIANT = input.variant ?? '';

const builder = await loadManagerBuilder({
  coreDir: input.coreDir,
  shimRemovedExports: input.shimRemovedExports,
});

// An empty config dir keeps `getConfig` from appending the project's own `manager` file, so the
// bundled entries are exactly the ones requested.
const scratchDir = mkdtempSync(join(tmpdir(), 'sb-manager-bench-'));
const outputDir = input.outputDir ?? join(scratchDir, 'out');
const config = await builder.getConfig({
  configDir: scratchDir,
  outputDir,
  cacheKey: input.cacheKey,
  presets: {
    apply: async (name: string, fallback: unknown) =>
      name === 'managerEntries' ? input.entries : name === 'env' ? input.envs : fallback,
  },
});

type OutputFile = { path: string; contents: Uint8Array };

/** What the manager builder does with the in-memory result of the esbuild-shaped paths. */
const writeOutputFiles = (files: OutputFile[]) =>
  Promise.all(
    files.map(async (file) => {
      if (!existsSync(file.path)) {
        await mkdir(dirname(file.path), { recursive: true });
      }
      await writeFile(file.path, file.contents);
    })
  );

let loadedAt = 0;
const runStep = async () => {
  if (input.bundler === 'external') {
    await builder.bundleManagerEntries(config, input.mode === 'build');
    return;
  }
  const instance = await builder.executor.get();
  loadedAt ||= performance.now();
  const result = await instance({
    ...config,
    ...(input.mode === 'build' && { minify: true }),
    ...(input.bundler === 'esbuild' &&
      input.variant === 'lite' && { minifySyntax: false, treeShaking: false }),
  });
  await writeOutputFiles(result.outputFiles);
};

const listFiles = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((item) =>
        item.isDirectory() ? listFiles(join(dir, item.name)) : [join(dir, item.name)]
      )
    : [];

const result: Record<string, unknown> = {
  bundler: input.bundler,
  variant: input.variant ?? '',
  mode: input.mode,
};
try {
  const usageBefore = process.resourceUsage();
  const start = performance.now();
  await runStep();
  const end = performance.now();
  const usage = process.resourceUsage();

  result.coldMs = end - start;
  result.loadMs = loadedAt ? loadedAt - start : null;
  // This process only: the work of esbuild's child process is not included
  result.usage = {
    userMs: (usage.userCPUTime - usageBefore.userCPUTime) / 1000,
    systemMs: (usage.systemCPUTime - usageBefore.systemCPUTime) / 1000,
    minorPageFaults: usage.minorPageFault - usageBefore.minorPageFault,
    involuntaryContextSwitches:
      usage.involuntaryContextSwitches - usageBefore.involuntaryContextSwitches,
  };

  const files = listFiles(config.outdir);
  const bytes = (extension: string) =>
    files
      .filter((file) => file.endsWith(extension))
      .reduce((sum, file) => sum + statSync(file).size, 0);
  result.jsBytes = bytes('.js');
  result.cssBytes = bytes('.css');
  result.files = files.length;

  const warmMs: number[] = [];
  for (let i = 0; i < (input.warmIterations ?? 0); i++) {
    const before = performance.now();
    await runStep();
    warmMs.push(performance.now() - before);
  }
  result.warmMs = warmMs;
} catch (error) {
  result.error = String((error as Error)?.message ?? error).slice(0, 2000);
}

if (!input.outputDir) {
  rmSync(scratchDir, { recursive: true, force: true });
}

process.stdout.write(`\n__RESULT__${JSON.stringify(result)}\n`);
process.exit(0);
