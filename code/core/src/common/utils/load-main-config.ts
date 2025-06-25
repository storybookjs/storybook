import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  MainFileESMOnlyImportError,
  MainFileEvaluationError,
} from 'storybook/internal/server-errors';
import type { StorybookConfig } from 'storybook/internal/types';

import { fileURLToPath } from 'mlly';
import { resolveSync } from 'mlly';

import { importModule } from '../../shared/utils/module';
import { validateConfigurationFiles } from './validate-configuration-files';

export async function loadMainConfig({
  configDir = '.storybook',
  cwd,
}: {
  configDir: string;
  cwd?: string;
}): Promise<StorybookConfig> {
  await validateConfigurationFiles(configDir, cwd);

  console.log({
    RESOLVED: resolve(configDir, 'main'),
    PATH: pathToFileURL(resolve(configDir, 'main')).href,
  });
  // pathToFileURL is a workaround for https://github.com/unjs/mlly/issues/297
  const mainUrl = resolveSync(pathToFileURL(resolve(configDir, 'main')).href, {
    extensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'],
  });

  console.log({
    MAIN_URL: mainUrl,
  });

  try {
    const out = await importModule(mainUrl);
    return out;
  } catch (e) {
    if (!(e instanceof Error)) {
      throw e;
    }
    if (e.message.match(/Cannot use import statement outside a module/)) {
      const location = relative(process.cwd(), fileURLToPath(mainUrl));
      const numFromStack = e.stack?.match(new RegExp(`${location}:(\\d+):(\\d+)`))?.[1];
      let num;
      let line;

      if (numFromStack) {
        const contents = await readFile(mainUrl, 'utf-8');
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
      location: relative(process.cwd(), fileURLToPath(mainUrl)),
      error: e,
    });
  }
}
