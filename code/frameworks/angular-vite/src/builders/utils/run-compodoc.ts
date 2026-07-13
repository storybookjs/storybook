import { isAbsolute, relative } from 'node:path';

import { JsPackageManagerFactory } from 'storybook/internal/common';

import { prompt } from 'storybook/internal/node-logger';

const hasTsConfigArg = (args: string[]) => args.indexOf('-p') !== -1;
const hasOutputArg = (args: string[]) =>
  args.indexOf('-d') !== -1 || args.indexOf('--output') !== -1;

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
