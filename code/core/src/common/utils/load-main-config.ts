import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { relative } from 'node:path';

import {
  MainFileESMOnlyImportError,
  MainFileEvaluationError,
} from 'storybook/internal/server-errors';
import type { StorybookConfig } from 'storybook/internal/types';

import { importPreset, resolveModule } from './preset-module-loader';
import { validateConfigurationFiles } from './validate-configuration-files';

export async function loadMainConfig({
  configDir = '.storybook',
  cwd,
}: {
  configDir: string;
  cwd?: string;
}): Promise<StorybookConfig> {
  await validateConfigurationFiles(configDir, cwd);

  const mainConfigPath = await resolveModule(path.resolve(configDir, 'main'));

  try {
    return (await importPreset(mainConfigPath)) as StorybookConfig;
  } catch (e) {
    if (!(e instanceof Error)) {
      throw e;
    }
    if (e.message.match(/Cannot use import statement outside a module/)) {
      const location = relative(process.cwd(), mainConfigPath);
      const numFromStack = e.stack?.match(new RegExp(`${location}:(\\d+):(\\d+)`))?.[1];
      let num;
      let line;

      if (numFromStack) {
        const contents = await readFile(mainConfigPath, 'utf-8');
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
      location: relative(process.cwd(), mainConfigPath),
      error: e,
    });
  }
}
