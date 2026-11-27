// `viteFinal` and the Compodoc run must agree here, or a redirected output regenerates every start.
import type { Preset } from 'storybook/internal/types';

import { resolve } from 'node:path';

import { findTsconfigUp } from './find-tsconfig.ts';

/** Compodoc invocation Storybook uses when `framework.options.compodocArgs` is unset. */
export const DEFAULT_COMPODOC_ARGS = ['-e', 'json', '-d', '.'];

/** File name Compodoc's JSON exporter writes into its output directory. */
export const DOCUMENTATION_JSON = 'documentation.json';

/**
 * Reads the `-d` / `--output` value out of `compodocArgs`, in either the separate-value or the
 * `--output=dir` spelling Commander accepts. Scanned backwards, because a later `-d` wins on the
 * command line; a malformed occurrence is skipped so an earlier one still counts.
 */
const readCompodocOutputDir = (compodocArgs: string[]): string | undefined => {
  for (let index = compodocArgs.length - 1; index >= 0; index--) {
    const arg = compodocArgs[index];
    if (arg.startsWith('--output=')) {
      return arg.slice('--output='.length) || undefined;
    }
    if (arg === '-d' || arg === '--output') {
      const value = compodocArgs[index + 1];
      if (typeof value === 'string' && !value.startsWith('-')) {
        return value;
      }
    }
  }
  return undefined;
};

/**
 * Resolves the Compodoc run every path in this framework has to agree on.
 *
 * The options type is the union of what is actually read, because Angular's builders and core's
 * `Options` each declare only part of it. `viteRoot` is Vite's own `root`, which only `viteFinal`
 * can supply: Vite's config does not exist at preset-evaluation time.
 */
export const resolveCompodocConfig = async (
  options?: {
    presets?: { apply: (key: string, fallback?: unknown) => Promise<unknown> };
    configDir?: string;
    tsConfig?: string;
    angularBuilderContext?: { workspaceRoot?: string } | null;
    angularBuilderOptions?: { tsConfig?: string; [option: string]: unknown };
  },
  extra: { viteRoot?: string } = {}
) => {
  // `framework` is either the framework's package name or `{ name, options }`; only the latter
  // carries the Compodoc settings.
  // `presets.apply` is untyped here, so the shape is asserted once at the boundary rather than at
  // each use.
  const framework = (await options?.presets?.apply('framework')) as Preset | undefined;
  const frameworkOptions: { compodoc?: boolean; compodocArgs?: string[]; tsconfig?: string } =
    typeof framework === 'string' ? {} : (framework?.options ?? {});

  const workspaceRoot =
    options?.angularBuilderContext?.workspaceRoot ??
    extra.viteRoot ??
    // Mirrors what builder-vite does with Vite's root, which only `viteFinal` can pass along. Without
    // it the docgen reader falls back to cwd and looks in a different directory than the writer.
    (options?.configDir ? resolve(options.configDir, '..') : undefined) ??
    process.cwd();
  const compodocArgs = frameworkOptions.compodocArgs ?? DEFAULT_COMPODOC_ARGS;

  return {
    /** `framework.options.compodoc`: `false` means the user opted out of Compodoc entirely. */
    enabled: frameworkOptions.compodoc !== false,
    compodocArgs,
    tsconfig:
      frameworkOptions.tsconfig ??
      options?.tsConfig ??
      options?.angularBuilderOptions?.tsConfig ??
      // The same walk the builders use, so Compodoc is pointed at the tsconfig the Angular build
      // would have picked rather than a different guess.
      (options?.configDir ? findTsconfigUp(options.configDir) : undefined) ??
      resolve(workspaceRoot, 'tsconfig.json'),
    /** Directory Compodoc runs in, and the base its relative `file` paths are written against. */
    workspaceRoot,
    /** Absolute directory Compodoc writes {@link DOCUMENTATION_JSON} into. */
    outputDir: resolve(workspaceRoot, readCompodocOutputDir(compodocArgs) ?? '.'),
  };
};
