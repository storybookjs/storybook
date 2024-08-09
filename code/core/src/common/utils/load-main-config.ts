import path, { relative } from 'node:path';

import type { StorybookConfig } from '@storybook/core/types';

import { MainFileESMOnlyImportError, MainFileEvaluationError } from '@storybook/core/server-errors';

import { readFile } from 'fs/promises';

import { serverRequire, serverResolve } from './interpret-require';
import { validateConfigurationFiles } from './validate-configuration-files';

export async function loadMainConfig({
  configDir = '.storybook',
  noCache = false,
}: {
  configDir: string;
  noCache?: boolean;
}): Promise<StorybookConfig> {
  await validateConfigurationFiles(configDir);

  const mainJsPath = serverResolve(path.resolve(configDir, 'main')) as string;

  if (noCache && mainJsPath && require.cache[mainJsPath]) {
    delete require.cache[mainJsPath];
  }

  try {
    const out = await serverRequire(mainJsPath);
    return out;
  } catch (e) {
    if (!(e instanceof Error)) {
      throw e;
    }
    if (e.message.match(/Cannot use import statement outside a module/)) {
      const location = relative(process.cwd(), mainJsPath);
      const numFromStack = e.stack?.match(new RegExp(`${location}:(\\d+):(\\d+)`))?.[1];
      let num;
      let line;

      if (numFromStack) {
        const contents = await readFile(mainJsPath, 'utf-8');
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
      location: relative(process.cwd(), mainJsPath),
      error: e,
    });
  }
}
