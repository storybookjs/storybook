import { isAbsolute, relative } from 'node:path';

import { JsPackageManagerFactory } from 'storybook/internal/common';

import { prompt } from 'storybook/internal/node-logger';

import { readCompodocOutputDir } from '../../compodoc-config.ts';

const hasTsConfigArg = (args: string[]) => args.indexOf('-p') !== -1;
// Derived from the reader rather than tested separately, so the directory Compodoc writes to and
// the directory the docgen provider reads from cannot disagree.
const hasOutputArg = (args: string[]) => readCompodocOutputDir(args) !== undefined;

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
    // Compodoc's own default output directory is not the workspace root, so an invocation that
    // names none is pinned to the directory the docgen provider reads from.
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
