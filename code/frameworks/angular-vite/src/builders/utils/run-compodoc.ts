import { isAbsolute, relative } from 'node:path';

import { JsPackageManagerFactory } from 'storybook/internal/common';

import { prompt } from 'storybook/internal/node-logger';

import { readCompodocOutputDir } from '../../compodoc-config.ts';
import { COMPODOC_TSCONFIG_OPTION, hasCompodocOption } from '../../compodoc-args.ts';

const hasTsConfigArg = (args: string[]) => hasCompodocOption(args, COMPODOC_TSCONFIG_OPTION);
// Derived from the reader rather than tested separately, so the directory Compodoc writes to and
// the directory the docgen provider reads from cannot disagree.
const hasOutputArg = (args: string[]) => readCompodocOutputDir(args) !== undefined;

// relative is necessary to workaround a compodoc issue with
// absolute paths on windows machines
const toRelativePath = (pathToTsConfig: string, workspaceRoot: string) => {
  return isAbsolute(pathToTsConfig)
    ? relative(workspaceRoot || '.', pathToTsConfig)
    : pathToTsConfig;
};

export type RunCompodocOptions = {
  compodocArgs: string[];
  tsconfig: string;
  workspaceRoot: string;
  env?: Record<string, string>;
  signal?: AbortSignal;
};

/** Builds the canonical package-manager command used by both one-shot and watch ownership. */
export const buildCompodocCommandArgs = (opts: RunCompodocOptions): string[] => {
  const { compodocArgs, tsconfig, workspaceRoot } = opts;
  const tsConfigPath = toRelativePath(tsconfig, workspaceRoot);
  return [
    'compodoc',
    ...(hasTsConfigArg(compodocArgs) ? [] : ['-p', tsConfigPath]),
    // Compodoc's own default output directory is not the workspace root, so an invocation that
    // names none is pinned to the directory the docgen provider reads from.
    ...(hasOutputArg(compodocArgs) ? [] : ['-d', `${workspaceRoot || '.'}`]),
    ...compodocArgs,
  ];
};

export const runCompodoc = async (opts: RunCompodocOptions): Promise<void> => {
  const { env, signal, workspaceRoot } = opts;
  const finalCompodocArgs = buildCompodocCommandArgs(opts);

  const packageManager = JsPackageManagerFactory.getPackageManager();

  await prompt.executeTaskWithSpinner(
    () =>
      packageManager.runPackageCommand({
        args: finalCompodocArgs,
        cwd: workspaceRoot,
        ...(env ? { env } : {}),
        ...(signal ? { signal } : {}),
      }),
    {
      id: 'compodoc',
      intro: 'Generating documentation with Compodoc',
      success: 'Compodoc finished successfully',
      error: 'Compodoc failed',
    }
  );
};
