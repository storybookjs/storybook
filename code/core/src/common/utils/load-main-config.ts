import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

import {
  MainFileESMOnlyImportError,
  MainFileEvaluationError,
} from 'storybook/internal/server-errors';
import type { StorybookConfig } from 'storybook/internal/types';

import { serverRequire, serverResolve } from './interpret-require';
import { validateConfigurationFiles } from './validate-configuration-files';

export async function loadMainConfig({
  configDir = '.storybook',
  noCache = false,
  cwd,
}: {
  configDir: string;
  noCache?: boolean;
  cwd?: string;
}): Promise<StorybookConfig> {
  await validateConfigurationFiles(configDir, cwd);

  const mainJsPath = serverResolve(resolve(configDir, 'main')) as string;

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
