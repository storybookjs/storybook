import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import {
  MainFileESMOnlyImportError,
  MainFileEvaluationError,
} from 'storybook/internal/server-errors';
import type { StorybookConfig } from 'storybook/internal/types';

import { importModule } from '../../shared/utils/module';
import { serverResolve } from './interpret-require';
import { validateConfigurationFiles } from './validate-configuration-files';

export async function loadMainConfig({
  configDir = '.storybook',
  cwd,
}: {
  configDir: string;
  cwd?: string;
}): Promise<StorybookConfig> {
  await validateConfigurationFiles(configDir, cwd);

  // pathToFileURL is a workaround for https://github.com/unjs/mlly/issues/297
  const mainPath = serverResolve(resolve(configDir, 'main')) as string;
  console.log({
    RESOLVED: resolve(configDir, 'main'),
  });

  console.log({
    MAIN_PATH: mainPath,
  });

  try {
    const out = await importModule(mainPath);
    return out;
  } catch (e) {
    if (!(e instanceof Error)) {
      throw e;
    }
    if (e.message.match(/Cannot use import statement outside a module/)) {
      const location = relative(process.cwd(), mainPath);
      const numFromStack = e.stack?.match(new RegExp(`${location}:(\\d+):(\\d+)`))?.[1];
      let num;
      let line;

      if (numFromStack) {
        const contents = await readFile(mainPath, 'utf-8');
        const lines = contents.split('\n');
        num = parseInt(numFromStack, 10) - 1;
        line = lines[num];
      }

      const out = new MainFileESMOnlyImportError({
        line,
        location,
        num,
      });

      delete out.stack;

      throw out;
    }

    throw new MainFileEvaluationError({
      location: relative(process.cwd(), mainPath),
      error: e,
    });
  }
}
