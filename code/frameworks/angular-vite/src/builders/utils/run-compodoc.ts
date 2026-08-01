import { isAbsolute, relative, resolve } from 'node:path';

import { JsPackageManagerFactory } from 'storybook/internal/common';

import { prompt } from 'storybook/internal/node-logger';

const hasTsConfigArg = (args: string[]) => args.indexOf('-p') !== -1;
const hasOutputArg = (args: string[]) =>
  args.indexOf('-d') !== -1 || args.indexOf('--output') !== -1;

// Compodoc writes documentation.json to the directory given by its output
// flag (-d / --output), resolved against the directory it runs from (the
// workspace root). Falls back to the workspace root when no output flag is
// present, matching the `-d ${workspaceRoot || '.'}` default injected below.
// Only the space-separated forms are recognized, mirroring `hasOutputArg`.
export const getCompodocOutputDir = (compodocArgs: string[], workspaceRoot: string): string => {
  let outputDir = resolve(workspaceRoot);
  for (let i = 0; i < compodocArgs.length; i++) {
    const arg = compodocArgs[i];
    if (arg !== '-d' && arg !== '--output') {
      continue;
    }
    const value = compodocArgs[i + 1];
    // A dangling output flag (e.g. '-d' as the last argument) has no path;
    // skip it so a following flag is never misread as the output directory.
    // Compodoc rejects such malformed invocations itself.
    if (value && !value.startsWith('-')) {
      outputDir = resolve(workspaceRoot, value);
    }
  }
  return outputDir;
};

// relative is necessary to workaround a compodoc issue with
// absolute paths on windows machines
const toRelativePath = (pathToTsConfig: string) => {
  return isAbsolute(pathToTsConfig) ? relative('.', pathToTsConfig) : pathToTsConfig;
};

export type RunCompodocOptions = {
  compodocArgs: string[];
  tsconfig: string;
  workspaceRoot: string;
};

export const runCompodoc = async (opts: RunCompodocOptions): Promise<void> => {
  const { compodocArgs, tsconfig, workspaceRoot } = opts;
  const tsConfigPath = toRelativePath(tsconfig);
  const finalCompodocArgs = [
    'compodoc',
    ...(hasTsConfigArg(compodocArgs) ? [] : ['-p', tsConfigPath]),
    ...(hasOutputArg(compodocArgs) ? [] : ['-d', `${workspaceRoot || '.'}`]),
    ...compodocArgs,
  ];

  const packageManager = JsPackageManagerFactory.getPackageManager();

  await prompt.executeTaskWithSpinner(
    () =>
      packageManager.runPackageCommand({
        args: finalCompodocArgs,
        cwd: workspaceRoot,
      }),
    {
      id: 'compodoc',
      intro: 'Generating documentation with Compodoc',
      success: 'Compodoc finished successfully',
      error: 'Compodoc failed',
    }
  );
};
