import { JsPackageManagerFactory } from 'storybook/internal/common';

import { BuilderContext } from '@angular-devkit/architect';
import * as path from 'node:path';
import { Observable } from 'rxjs';

const hasTsConfigArg = (args: string[]) => args.indexOf('-p') !== -1;
const hasOutputArg = (args: string[]) =>
  args.indexOf('-d') !== -1 || args.indexOf('--output') !== -1;

// path.relative is necessary to workaround a compodoc issue with
// absolute paths on windows machines
const toRelativePath = (pathToTsConfig: string) => {
  return path.isAbsolute(pathToTsConfig) ? path.relative('.', pathToTsConfig) : pathToTsConfig;
};

export const runCompodoc = (
  { compodocArgs, tsconfig }: { compodocArgs: string[]; tsconfig: string },
  context: BuilderContext
): Observable<void> => {
  return new Observable<void>((observer) => {
    const tsConfigPath = toRelativePath(tsconfig);
    const finalCompodocArgs = [
      ...(hasTsConfigArg(compodocArgs) ? [] : ['-p', tsConfigPath]),
      ...(hasOutputArg(compodocArgs) ? [] : ['-d', `${context.workspaceRoot || '.'}`]),
      ...compodocArgs,
    ];

    const packageManager = JsPackageManagerFactory.getPackageManager();

    try {
      const stdout = packageManager.runPackageCommandSync(
        'compodoc',
        finalCompodocArgs,
        context.workspaceRoot,
        'inherit'
      );

      context.logger.info(stdout);
      observer.next();
      observer.complete();
    } catch (e) {
      context.logger.error(e);
      observer.error();
    }
  });
};
