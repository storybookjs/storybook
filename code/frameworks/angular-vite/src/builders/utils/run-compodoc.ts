import { isAbsolute, relative, resolve } from 'node:path';

import { JsPackageManagerFactory } from 'storybook/internal/common';

import { prompt } from 'storybook/internal/node-logger';

const hasTsConfigArg = (args: string[]) => args.indexOf('-p') !== -1;

// Whether an argument is Compodoc's output flag, matching the forms the
// Commander-based CLI actually parses: the separated `-d value` / `--output
// value` and the inline `-ddocs` / `--output=docs`. An inline `-d=value` is
// also matched because Commander reads it as the output flag (with value
// `=value`); `--outputdocs` is not, because Commander treats it as an unknown
// flag rather than the output option.
const isOutputArg = (arg: string): boolean => {
  if (arg === '-d' || arg === '--output') {
    return true;
  }
  if (arg.startsWith('-d') && arg.length > 2) {
    return true;
  }
  return arg.startsWith('--output=');
};

const hasOutputArg = (args: string[]) => args.some(isOutputArg);

// Compodoc writes documentation.json to the directory given by its output
// flag (-d / --output), resolved against the directory it runs from (the
// workspace root). Falls back to the workspace root when no output flag is
// present, matching the `-d ${workspaceRoot || '.'}` default injected below.
export const getCompodocOutputDir = (compodocArgs: string[], workspaceRoot: string): string => {
  let outputDir = resolve(workspaceRoot);
  for (let i = 0; i < compodocArgs.length; i++) {
    const arg = compodocArgs[i];
    if (arg === '-d' || arg === '--output') {
      const value = compodocArgs[i + 1];
      // A dangling output flag (e.g. '-d' as the last argument) has no path;
      // skip it so a following flag is never misread as the output directory.
      // Compodoc rejects such malformed invocations itself.
      if (value && !value.startsWith('-')) {
        outputDir = resolve(workspaceRoot, value);
      }
    } else if (arg.startsWith('-d') && arg.length > 2) {
      // Inline short value (-ddocs, -d=value), matching Commander.
      outputDir = resolve(workspaceRoot, arg.slice(2));
    } else if (arg.startsWith('--output=')) {
      // Inline long `=` value (--output=docs), matching Commander.
      outputDir = resolve(workspaceRoot, arg.slice('--output='.length));
    }
  }
  return outputDir;
};

// relative is necessary to workaround a compodoc issue with
// absolute paths on Windows machines
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
