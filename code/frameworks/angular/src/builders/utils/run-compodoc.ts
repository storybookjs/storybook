import { isAbsolute, relative } from 'node:path';

import { JsPackageManagerFactory } from 'storybook/internal/common';

import type { BuilderContext } from '@angular-devkit/architect';
import { prompt } from 'storybook/internal/node-logger';

const hasTsConfigArg = (args: string[]) => args.indexOf('-p') !== -1;
const hasOutputArg = (args: string[]) =>
  args.indexOf('-d') !== -1 || args.indexOf('--output') !== -1;

// relative is necessary to workaround a compodoc issue with
// absolute paths on windows machines
const toRelativePath = (pathToTsConfig: string) => {
  return isAbsolute(pathToTsConfig) ? relative('.', pathToTsConfig) : pathToTsConfig;
};

export const runCompodoc = async (
  { compodocArgs, tsconfig }: { compodocArgs: string[]; tsconfig: string },
  context: BuilderContext
): Promise<void> => {
  const tsConfigPath = toRelativePath(tsconfig);
  const finalCompodocArgs = [
    'compodoc',
    ...(hasTsConfigArg(compodocArgs) ? [] : ['-p', tsConfigPath]),
    ...(hasOutputArg(compodocArgs) ? [] : ['-d', `${context.workspaceRoot || '.'}`]),
    ...compodocArgs,
  ];

  const packageManager = JsPackageManagerFactory.getPackageManager();

  await prompt.executeTaskWithSpinner(
    () =>
      packageManager.runPackageCommand({
        args: finalCompodocArgs,
        cwd: context.workspaceRoot,
      }),
    {
      id: 'compodoc',
      intro: 'Generating documentation with Compodoc',
      success: 'Compodoc finished successfully',
      error: 'Compodoc failed',
    }
  );
};
